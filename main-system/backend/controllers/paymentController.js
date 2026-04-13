const { query, withTransaction } = require('../../../shared/db/db');
const { success, created, notFound, error } = require('../../../shared/utils/response');
const QRCode = require('qrcode');
const crypto = require('crypto');
const { logger } = require('../../../shared/utils/logger');

const getUserUniversity = async (userId) => {
    const { rows } = await query('SELECT university_id FROM users WHERE id = $1', [userId]);
    return rows[0]?.university_id;
};

const getVendorId = async (userId) => {
    const { rows } = await query('SELECT id FROM users WHERE id = $1 AND role IN ($2, $3)',
        [userId, 'vendor', 'admin']);
    return rows[0]?.id;
};

const getVendorPaymentMethods = async (req, res, next) => {
    try {
        const vendorId = req.user.id;
        const universityId = await getUserUniversity(vendorId);

        if (!universityId) {
            return error(res, 'No university associated with your account', 400);
        }

        const { rows } = await query(
            `SELECT * FROM vendor_payment_methods WHERE vendor_id = $1 AND university_id = $2 ORDER BY is_default DESC, created_at DESC`,
            [vendorId, universityId]
        );

        return success(res, rows);
    } catch (err) {
        console.error('Get vendor payment methods error:', err);
        next(err);
    }
};

const upsertPaymentMethod = async (req, res, next) => {
    try {
        const vendorId = req.user.id;
        const universityId = await getUserUniversity(vendorId);

        if (!universityId) {
            return error(res, 'No university associated with your account. Please contact administrator.', 400);
        }

        const { id, provider, method_type, lipa_number, account_name, api_key, api_secret, merchant_id, api_endpoint, is_active, is_default } = req.body;

        if (method_type === 'lipa' && !lipa_number) {
            return error(res, 'Lipa number is required for manual payment method', 400);
        }

        if (method_type === 'stk' && (!api_key || !api_secret || !merchant_id)) {
            return error(res, 'API credentials are required for STK Push method', 400);
        }

        if (is_default) {
            await query(
                `UPDATE vendor_payment_methods SET is_default = false WHERE vendor_id = $1 AND university_id = $2`,
                [vendorId, universityId]
            );
        }

        let result;
        if (id) {
            result = await query(
                `UPDATE vendor_payment_methods SET provider = $1, method_type = $2, lipa_number = $3, account_name = $4, api_key = $5, api_secret = $6, merchant_id = $7, api_endpoint = $8, is_active = $9, is_default = $10, updated_at = NOW() WHERE id = $11 AND university_id = $13 RETURNING *`,
                [provider, method_type, lipa_number, account_name, api_key, api_secret, merchant_id, api_endpoint, is_active, is_default, id, vendorId, universityId]
            );
        } else {
            result = await query(
                `INSERT INTO vendor_payment_methods (vendor_id, university_id, provider, method_type, lipa_number, account_name, api_key, api_secret, merchant_id, api_endpoint, is_active, is_default) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
                [vendorId, universityId, provider, method_type, lipa_number, account_name, api_key, api_secret, merchant_id, api_endpoint, is_active, is_default]
            );
        }

        if (!result.row[0]) return notFound(res, 'Payment not found');
        console.log(`Payment method ${id ? 'updated' : 'added' } for vendor ${vendorId} (university: ${universityId}): ${provider} (${method_type})`);
        return success(res, result.rows[0], `Payment method ${id ? 'updated' : 'added'} successfully`);
    } catch (err) {
        console.error('Upsert payment method error:', err);
        next(err);
    }
};

// Delete payment method
const deletePaymentMethod = async (req, res, next) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.id;

        const { rows } = await query(
            `DELETE FROM vendor_payment_methods WHERE id = $1 AND vendor_id = $2 RETURNING id`,
            [id, vendorId]
        );

        if (!rows[0]) return notFound(res, 'Payment method not found');

        logger.info(`Payment method ${id} deleted by vendor ${vendorId}`);
        return success(res, null, 'Payment method deleted');
    } catch (err) {
        logger.error('Delete payment method error:', err);
        next(err);
    }
};

// Toggle payment method status
const togglePaymentMethodStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        const vendorId = req.user.id;

        const { rows } = await query(
            `UPDATE vendor_payment_methods
             SET is_active = $1, updated_at = NOW()
             WHERE id = $2 AND vendor_id = $3
             RETURNING *`,
            [is_active, id, vendorId]
        );

        if (!rows[0]) return notFound(res, 'Payment method not found');

        logger.info(`Payment method ${id} ${is_active ? 'activated' : 'deactivated'} by vendor ${vendorId}`);
        return success(res, rows[0], `Payment method ${is_active ? 'activated' : 'deactivated'}`);
    } catch (err) {
        logger.error('Toggle payment method error:', err);
        next(err);
    }
};

// Get vendor's active payment method for checkout
const getActivePaymentMethod = async (req, res, next) => {
    try {
        const vendorId = req.params.vendorId || req.user.id;

        const { rows } = await query(
            `SELECT * FROM vendor_payment_methods
             WHERE vendor_id = $1 AND is_active = true
             ORDER BY is_default DESC, created_at DESC
             LIMIT 1`,
            [vendorId]
        );

        if (!rows[0]) {
            return success(res, null, 'No active payment method found');
        }

        return success(res, rows[0]);
    } catch (err) {
        logger.error('Get active payment method error:', err);
        next(err);
    }
};

// ── POST /payments/initiate ────────────────────────────────────
// Now supports both Lipa and STK Push based on vendor configuration
const initiatePayment = async (req, res, next) => {
    try {
        const { order_id, phone_number } = req.body;

        // Get order with vendor info
        const { rows: [order] } = await query(
            `SELECT o.*, u.id as vendor_id FROM orders o
             JOIN users u ON o.vendor_id = u.id
             WHERE o.id = $1`,
            [order_id]
        );
        if (!order) return notFound(res, 'Order not found');
        if (order.status !== 'pending') return error(res, `Order is already ${order.status}`);

        // Get vendor's active payment method
        const { rows: [paymentMethod] } = await query(
            `SELECT * FROM vendor_payment_methods
             WHERE vendor_id = $1 AND is_active = true
             ORDER BY is_default DESC LIMIT 1`,
            [order.vendor_id]
        );

        if (!paymentMethod) {
            return error(res, 'Vendor has no active payment method configured', 400);
        }

        // Create payment record
        const { rows: [payment] } = await query(`
            INSERT INTO payments (order_id, provider, phone_number, amount, status, payment_method)
            VALUES ($1, $2, $3, $4, 'processing', $5)
            RETURNING *
        `, [order_id, paymentMethod.provider, phone_number, order.total, paymentMethod.method_type]);

        // Create transaction record
        const transactionCode = 'TXN-' + Date.now() + '-' + crypto.randomBytes(4).toString('hex').toUpperCase();
        const { rows: [transaction] } = await query(`
            INSERT INTO transactions (order_id, vendor_id, customer_id, amount, phone_number, transaction_code, provider, payment_method, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'processing')
            RETURNING *
        `, [order_id, order.vendor_id, req.user.id, order.total, phone_number, transactionCode, paymentMethod.provider, paymentMethod.method_type]);

        logger.info(`Payment initiated: ${payment.id} for order ${order_id} using ${paymentMethod.method_type} (${paymentMethod.provider})`);

        // Determine flow based on payment method type
        if (paymentMethod.method_type === 'lipa') {
            // Manual Lipa flow - return instructions
            return success(res, {
                payment_id: payment.id,
                transaction_id: transaction.id,
                transaction_code: transaction.transaction_code,
                order_id,
                provider: paymentMethod.provider,
                amount: order.total,
                payment_flow: 'manual',
                status: 'pending',
                payment_instructions: {
                    lipa_number: paymentMethod.lipa_number,
                    account_name: paymentMethod.account_name,
                    reference: transaction.transaction_code,
                    message: `Please send ${order.total} TZS to ${paymentMethod.provider} number ${paymentMethod.lipa_number} with reference ${transaction.transaction_code}`
                },
                message: `Please complete payment to ${paymentMethod.lipa_number} using reference ${transaction.transaction_code}`
            });
        } else {
            // STK Push flow - integrate with payment gateway
            // TODO: Implement actual STK Push integration with Selcom/other provider
            // For now, simulate STK push
            logger.info(`STK Push simulation: ${paymentMethod.provider} - ${phone_number} - TZS ${order.total}`);

            // Simulate callback after 5 seconds (in production, this would be a webhook)
            setTimeout(async () => {
                try {
                    await query(`
                        UPDATE payments SET status = 'success', completed_at = NOW() WHERE id = $1
                    `, [payment.id]);
                    await query(`
                        UPDATE transactions SET status = 'success', updated_at = NOW() WHERE id = $1
                    `, [transaction.id]);
                    await query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [order_id]);

                    // Generate QR code for order pickup
                    const token = crypto.randomBytes(24).toString('hex');
                    const expiryMins = parseInt(process.env.QR_EXPIRY_MINUTES) || 30;
                    const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000);
                    const qrData = JSON.stringify({ order_id, token, exp: expiresAt.toISOString() });
                    const qrImage = await QRCode.toDataURL(qrData, {
                        errorCorrectionLevel: 'H',
                        margin: 2,
                        color: { dark: '#16120E', light: '#FFFFFF' },
                    });

                    await query(`
                        INSERT INTO qr_tokens (order_id, token, qr_image_url, expires_at)
                        VALUES ($1, $2, $3, $4)
                    `, [order_id, token, qrImage, expiresAt]);

                    logger.info(`STK Push payment confirmed for order ${order_id}`);
                } catch (err) {
                    logger.error('STK Push callback error:', err);
                }
            }, 5000);

            return success(res, {
                payment_id: payment.id,
                transaction_id: transaction.id,
                transaction_code: transaction.transaction_code,
                order_id,
                provider: paymentMethod.provider,
                amount: order.total,
                payment_flow: 'automated',
                status: 'processing',
                message: `STK Push sent to ${phone_number}. Please enter your PIN to complete payment.`
            });
        }
    } catch (err) {
        logger.error('Initiate payment error:', err);
        next(err);
    }
};

// ── POST /payments/confirm-manual ──────────────────────────────
// User confirms manual Lipa payment with transaction ID
const confirmManualPayment = async (req, res, next) => {
    try {
        const { transaction_id, transaction_code, phone_number } = req.body;

        // Find transaction
        const { rows: [transaction] } = await query(
            `SELECT t.*, o.id as order_id, o.status as order_status
             FROM transactions t
             JOIN orders o ON t.order_id = o.id
             WHERE t.id = $1 OR t.transaction_code = $2`,
            [transaction_id, transaction_code]
        );

        if (!transaction) return notFound(res, 'Transaction not found');

        if (transaction.status !== 'processing') {
            return error(res, `Payment already ${transaction.status}`, 400);
        }

        // Update transaction to pending_verification
        await query(
            `UPDATE transactions
             SET status = 'pending_verification',
                 phone_number = COALESCE($1, phone_number),
                 updated_at = NOW()
             WHERE id = $2`,
            [phone_number, transaction.id]
        );

        // Update payment record
        await query(
            `UPDATE payments
             SET status = 'pending_verification', updated_at = NOW()
             WHERE order_id = $1`,
            [transaction.order_id]
        );

        // Update order status
        await query(
            `UPDATE orders SET status = 'pending_verification', updated_at = NOW() WHERE id = $1`,
            [transaction.order_id]
        );

        logger.info(`Manual payment confirmation submitted for transaction ${transaction.transaction_code}`);

        return success(res, {
            transaction_id: transaction.id,
            transaction_code: transaction.transaction_code,
            status: 'pending_verification',
            message: 'Payment confirmation submitted. Waiting for vendor verification.'
        });
    } catch (err) {
        logger.error('Confirm manual payment error:', err);
        next(err);
    }
};

// ── POST /payments/verify-payment ──────────────────────────────
// Vendor verifies manual payment
const verifyPayment = async (req, res, next) => {
    try {
        const { transaction_id, is_verified, notes } = req.body;
        const vendorId = req.user.id;

        const { rows: [transaction] } = await query(
            `SELECT t.*, o.vendor_id
             FROM transactions t
             JOIN orders o ON t.order_id = o.id
             WHERE t.id = $1 AND o.vendor_id = $2`,
            [transaction_id, vendorId]
        );

        if (!transaction) return notFound(res, 'Transaction not found or not authorized');

        if (transaction.status !== 'pending_verification') {
            return error(res, `Cannot verify payment in status: ${transaction.status}`, 400);
        }

        if (is_verified) {
            await withTransaction(async (client) => {
                // Update transaction to success
                await client.query(
                    `UPDATE transactions
                     SET status = 'success',
                         verified_by = $1,
                         verified_at = NOW(),
                         notes = $2,
                         updated_at = NOW()
                     WHERE id = $3`,
                    [vendorId, notes, transaction.id]
                );

                // Update payment record
                await client.query(
                    `UPDATE payments
                     SET status = 'success', completed_at = NOW()
                     WHERE order_id = $1`,
                    [transaction.order_id]
                );

                // Update order status to paid
                await client.query(
                    `UPDATE orders SET status = 'paid', updated_at = NOW() WHERE id = $1`,
                    [transaction.order_id]
                );

                // Generate QR code for order pickup
                const token = crypto.randomBytes(24).toString('hex');
                const expiryMins = parseInt(process.env.QR_EXPIRY_MINUTES) || 30;
                const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000);
                const qrData = JSON.stringify({ order_id: transaction.order_id, token, exp: expiresAt.toISOString() });
                const qrImage = await QRCode.toDataURL(qrData, {
                    errorCorrectionLevel: 'H',
                    margin: 2,
                    color: { dark: '#16120E', light: '#FFFFFF' },
                });

                await client.query(
                    `INSERT INTO qr_tokens (order_id, token, qr_image_url, expires_at)
                     VALUES ($1, $2, $3, $4)`,
                    [transaction.order_id, token, qrImage, expiresAt]
                );
            });

            logger.info(`Payment verified for transaction ${transaction.transaction_code} by vendor ${vendorId}`);
            return success(res, {
                transaction_id: transaction.id,
                status: 'success',
                message: 'Payment verified successfully'
            });
        } else {
            // Mark as failed
            await query(
                `UPDATE transactions
                 SET status = 'failed',
                     verified_by = $1,
                     notes = $2,
                     updated_at = NOW()
                 WHERE id = $3`,
                [vendorId, notes || 'Payment verification failed', transaction.id]
            );

            return success(res, {
                transaction_id: transaction.id,
                status: 'failed',
                message: 'Payment verification failed'
            });
        }
    } catch (err) {
        logger.error('Verify payment error:', err);
        next(err);
    }
};

// ── POST /payments/confirm — webhook / STK callback ───────────
const confirmPayment = async (req, res, next) => {
    try {
        const { payment_id, provider_ref, status = 'success', transaction_code } = req.body;

        const result = await withTransaction(async (client) => {
            // Update payment
            const { rows: [payment] } = await client.query(`
                UPDATE payments SET status = $1, provider_ref = $2, completed_at = NOW()
                WHERE id = $3 RETURNING *
            `, [status, provider_ref || 'SIMULATED', payment_id]);
            if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });

            // Update transaction if transaction_code provided
            if (transaction_code) {
                await client.query(`
                    UPDATE transactions SET status = $1, provider_reference = $2, updated_at = NOW()
                    WHERE transaction_code = $3
                `, [status === 'success' ? 'success' : 'failed', provider_ref, transaction_code]);
            }

            if (status !== 'success') {
                await client.query(`UPDATE orders SET status = 'cancelled' WHERE id = $1`, [payment.order_id]);
                return { payment, qr: null };
            }

            // Update order status to paid
            await client.query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [payment.order_id]);

            // Generate QR token
            const token = crypto.randomBytes(24).toString('hex');
            const expiryMins = parseInt(process.env.QR_EXPIRY_MINUTES) || 30;
            const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000);

            // Generate QR code as base64 PNG
            const qrData = JSON.stringify({ order_id: payment.order_id, token, exp: expiresAt.toISOString() });
            const qrImage = await QRCode.toDataURL(qrData, {
                errorCorrectionLevel: 'H',
                margin: 2,
                color: { dark: '#16120E', light: '#FFFFFF' },
            });

            const { rows: [qr] } = await client.query(`
                INSERT INTO qr_tokens (order_id, token, qr_image_url, expires_at)
                VALUES ($1, $2, $3, $4) RETURNING *
            `, [payment.order_id, token, qrImage, expiresAt]);

            return { payment, qr };
        });

        logger.info(`Payment confirmed: ${payment_id} → order QR generated`);
        return success(res, result, 'Payment confirmed');
    } catch (err) {
        if (err.statusCode) return error(res, err.message, err.statusCode);
        next(err);
    }
};

// ── POST /payments/verify-qr — staff scans QR ────────────────
const verifyQR = async (req, res, next) => {
    try {
        const { token } = req.body;
        if (!token) return error(res, 'QR token required');

        const { rows: [qr] } = await query(`
            SELECT q.*, o.status AS order_status,
                COALESCE(u.name, o.guest_name, 'Guest') AS customer_name,
                COALESCE(u.reg_number, '—') AS reg_number,
                (SELECT json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity, 'subtotal', oi.subtotal))
                 FROM order_items oi WHERE oi.order_id = o.id) AS items,
                o.total, o.subtotal, o.service_charge,
                p.provider AS payment_provider
            FROM qr_tokens q
            JOIN orders o ON o.id = q.order_id
            LEFT JOIN users u ON u.id = o.user_id
            LEFT JOIN payments p ON p.order_id = o.id AND p.status = 'success'
            WHERE q.token = $1
        `, [token]);

        if (!qr) return error(res, 'Invalid QR code', 404);
        if (qr.is_used) return error(res, 'QR code already used', 409);
        if (new Date(qr.expires_at) < new Date()) return error(res, 'QR code expired', 410);

        return success(res, {
            valid: true,
            order_id: qr.order_id,
            token: qr.token,
            customer_name: qr.customer_name,
            reg_number: qr.reg_number,
            items: qr.items,
            total: qr.total,
            payment_provider: qr.payment_provider,
            expires_at: qr.expires_at,
        }, 'QR code is valid');
    } catch (err) { next(err); }
};

// ── POST /payments/redeem-qr — mark order served ─────────────
const redeemQR = async (req, res, next) => {
    try {
        const { token } = req.body;

        const result = await withTransaction(async (client) => {
            const { rows: [qr] } = await client.query(
                'SELECT * FROM qr_tokens WHERE token = $1 FOR UPDATE',
                [token]
            );
            if (!qr) throw Object.assign(new Error('Invalid QR code'), { statusCode: 404 });
            if (qr.is_used) throw Object.assign(new Error('QR code already used'), { statusCode: 409 });
            if (new Date(qr.expires_at) < new Date()) throw Object.assign(new Error('QR code expired'), { statusCode: 410 });

            await client.query(
                'UPDATE qr_tokens SET is_used = true, used_by = $1, used_at = NOW() WHERE id = $2',
                [req.user.id, qr.id]
            );
            await client.query(
                'UPDATE orders SET status = $1 WHERE id = $2',
                ['served', qr.order_id]
            );

            return qr.order_id;
        });

        logger.info(`QR redeemed for order ${result} by staff ${req.user.reg_number}`);
        return success(res, { order_id: result, served_at: new Date() }, 'Order marked as served');
    } catch (err) {
        if (err.statusCode) return error(res, err.message, err.statusCode);
        next(err);
    }
};

// ── GET /payments/:orderId/qr — get QR image ─────────────────
const getQR = async (req, res, next) => {
    try {
        const { rows: [qr] } = await query(
            `SELECT q.* FROM qr_tokens q
             JOIN orders o ON o.id = q.order_id
             WHERE q.order_id = $1 AND q.is_used = false AND q.expires_at > NOW()
             ORDER BY q.created_at DESC LIMIT 1`,
            [req.params.orderId]
        );
        if (!qr) return notFound(res, 'No active QR code for this order');
        return success(res, { qr_image: qr.qr_image_url, token: qr.token, expires_at: qr.expires_at });
    } catch (err) { next(err); }
};

// ── GET /payments/transactions — get vendor transactions ──────
const getVendorTransactions = async (req, res, next) => {
    try {
        const vendorId = req.user.id;
        const { page = 1, limit = 20, status } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE t.vendor_id = $1';
        const params = [vendorId];
        let idx = 2;

        if (status) {
            whereClause += ` AND t.status = $${idx++}`;
            params.push(status);
        }

        const { rows } = await query(
            `SELECT t.*, o.id as order_id, o.total as order_total,
                    u.name as customer_name
             FROM transactions t
             JOIN orders o ON t.order_id = o.id
             LEFT JOIN users u ON t.customer_id = u.id
             ${whereClause}
             ORDER BY t.created_at DESC
             LIMIT $${idx++} OFFSET $${idx}`,
            [...params, limit, offset]
        );

        const { rows: countRows } = await query(
            `SELECT COUNT(*) FROM transactions t ${whereClause}`,
            params
        );

        return success(res, {
            transactions: rows,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total: parseInt(countRows[0].count),
                pages: Math.ceil(countRows[0].count / limit)
            }
        });
    } catch (err) {
        logger.error('Get vendor transactions error:', err);
        next(err);
    }
};

// ── GET /payments/status/:orderId — get payment status ────────
const getPaymentStatus = async (req, res, next) => {
    try {
        const { orderId } = req.params;

        const { rows: [payment] } = await query(
            `SELECT p.status as payment_status, p.provider, p.amount,
                    t.status as transaction_status, t.transaction_code,
                    o.status as order_status
             FROM payments p
             LEFT JOIN transactions t ON p.order_id = t.order_id
             JOIN orders o ON p.order_id = o.id
             WHERE p.order_id = $1
             ORDER BY p.created_at DESC LIMIT 1`,
            [orderId]
        );

        if (!payment) return notFound(res, 'Payment not found');

        return success(res, payment);
    } catch (err) {
        logger.error('Get payment status error:', err);
        next(err);
    }
};

module.exports = {
    initiatePayment,
    confirmPayment,
    verifyQR,
    redeemQR,
    getQR,
    getVendorPaymentMethods,
    upsertPaymentMethod,
    deletePaymentMethod,
    togglePaymentMethodStatus,
    getActivePaymentMethod,
    confirmManualPayment,
    verifyPayment,
    getVendorTransactions,
    getPaymentStatus
};