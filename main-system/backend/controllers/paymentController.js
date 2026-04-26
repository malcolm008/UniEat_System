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
            `SELECT * FROM vendor_payment_methods
             WHERE vendor_id = $1 AND university_id = $2
             ORDER BY is_default DESC, created_at DESC`,
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

        // Validate required fields based on method type
        if (method_type === 'lipa' && !lipa_number) {
            return error(res, 'Lipa number is required for manual payment method', 400);
        }

        if (method_type === 'stk' && (!api_key || !api_secret || !merchant_id)) {
            return error(res, 'API credentials are required for STK Push method', 400);
        }

        // If setting as default, unset other defaults for this university
        if (is_default) {
            await query(
                `UPDATE vendor_payment_methods SET is_default = false
                 WHERE vendor_id = $1 AND university_id = $2`,
                [vendorId, universityId]
            );
        }

        let result;

        // If an ID is provided, try to update first
        if (id) {
            // Check if the record exists
            const existing = await query(
                `SELECT id FROM vendor_payment_methods
                 WHERE id = $1 AND vendor_id = $2 AND university_id = $3`,
                [id, vendorId, universityId]
            );

            if (existing.rows.length > 0) {
                // Update existing record
                result = await query(
                    `UPDATE vendor_payment_methods
                     SET provider = $1,
                         method_type = $2,
                         lipa_number = $3,
                         account_name = $4,
                         api_key = $5,
                         api_secret = $6,
                         merchant_id = $7,
                         api_endpoint = $8,
                         is_active = $9,
                         is_default = $10,
                         updated_at = NOW()
                     WHERE id = $11 AND vendor_id = $12 AND university_id = $13
                     RETURNING *`,
                    [provider, method_type, lipa_number, account_name,
                     api_key, api_secret, merchant_id, api_endpoint,
                     is_active, is_default, id, vendorId, universityId]
                );
            } else {
                // ID provided but doesn't exist, treat as insert
                result = await query(
                    `INSERT INTO vendor_payment_methods
                     (vendor_id, university_id, provider, method_type, lipa_number, account_name,
                      api_key, api_secret, merchant_id, api_endpoint, is_active, is_default)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                     ON CONFLICT (vendor_id, provider, university_id)
                     DO UPDATE SET
                         method_type = EXCLUDED.method_type,
                         lipa_number = EXCLUDED.lipa_number,
                         account_name = EXCLUDED.account_name,
                         api_key = EXCLUDED.api_key,
                         api_secret = EXCLUDED.api_secret,
                         merchant_id = EXCLUDED.merchant_id,
                         api_endpoint = EXCLUDED.api_endpoint,
                         is_active = EXCLUDED.is_active,
                         is_default = EXCLUDED.is_default,
                         updated_at = NOW()
                     RETURNING *`,
                    [vendorId, universityId, provider, method_type, lipa_number, account_name,
                     api_key, api_secret, merchant_id, api_endpoint, is_active, is_default]
                );
            }
        } else {
            // No ID provided, insert new with conflict handling
            result = await query(
                `INSERT INTO vendor_payment_methods
                 (vendor_id, university_id, provider, method_type, lipa_number, account_name,
                  api_key, api_secret, merchant_id, api_endpoint, is_active, is_default)
                 VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
                 ON CONFLICT (vendor_id, provider, university_id)
                 DO UPDATE SET
                     method_type = EXCLUDED.method_type,
                     lipa_number = EXCLUDED.lipa_number,
                     account_name = EXCLUDED.account_name,
                     api_key = EXCLUDED.api_key,
                     api_secret = EXCLUDED.api_secret,
                     merchant_id = EXCLUDED.merchant_id,
                     api_endpoint = EXCLUDED.api_endpoint,
                     is_active = EXCLUDED.is_active,
                     is_default = EXCLUDED.is_default,
                     updated_at = NOW()
                 RETURNING *`,
                [vendorId, universityId, provider, method_type, lipa_number, account_name,
                 api_key, api_secret, merchant_id, api_endpoint, is_active, is_default]
            );
        }

        if (!result || !result.rows[0]) {
            return error(res, 'Failed to save payment method', 500);
        }

        console.log(`Payment method ${id ? 'updated' : 'added'} for vendor ${vendorId} (university: ${universityId}): ${provider} (${method_type})`);
        return success(res, result.rows[0], `Payment method ${id ? 'updated' : 'added'} successfully`);
    } catch (err) {
        console.error('Upsert payment method error:', err);

        // Handle duplicate key error gracefully
        if (err.code === '23505') {
            return error(res, 'A payment method for this provider already exists. Please edit the existing one instead.', 409);
        }
        next(err);
    }
};

const deletePaymentMethod = async (req, res, next) => {
    try {
        const { id } = req.params;
        const vendorId = req.user.id;

        console.log('Delete payment method request:', { id, vendorId });

        // Get user's university ID
        const universityId = await getUserUniversity(vendorId);

        if (!universityId) {
            return error(res, 'No university associated with your account', 400);
        }

        console.log('University ID:', universityId);

        // Delete the payment method with all three conditions
        const result = await query(
            `DELETE FROM vendor_payment_methods
             WHERE id = $1 AND vendor_id = $2 AND university_id = $3
             RETURNING id`,
            [id, vendorId, universityId]
        );

        if (result.rows.length === 0) {
            return notFound(res, 'Payment method not found or you do not have permission to delete it');
        }

        console.log(`Payment method ${id} deleted successfully by vendor ${vendorId}`);
        return success(res, null, 'Payment method deleted successfully');
    } catch (err) {
        console.error('Delete payment method error:', err);
        next(err);
    }
};

const togglePaymentMethodStatus = async (req, res, next) => {
    try {
        const { id } = req.params;
        const { is_active } = req.body;
        const vendorId = req.user.id;
        const universityId = await getUserUniversity(vendorId);

        if (!universityId) {
            return error(res, 'No university associated with your account', 400);
        }

        const { rows } = await query(
            `UPDATE vendor_payment_methods SET is_active = $1, updated_at = NOW() WHERE id = $2 AND vendor_id = $3 AND university_id = $4 RETURNING *`,
            [is_active, id, vendorId, universityId]
        );

        if (!rows[0]) return notFound(res, 'Payment method not found');

        console.log(`Payment method ${id} ${is_active ? 'activated' : 'deactivated'} by vendor ${vendorId}`);
        return success(res, rows[0], `Payment method ${is_active ? 'activated' :  'deactivated'}`);
    } catch (err) {
        console.error('Toggle payment method error:', err);
        next(err);
    }
};

const getServiceFee = async (req, res, next) => {
    try {
        const universityId = await getUserUniversity(req.user.id);

        if (!universityId) {
            return error(res, 'No university associated with your account', 400);
        }

        const { rows } = await query(
            `SELECT setting_value FROM system_settings WHERE setting_key = 'service_fee_percentage' AND university_id = $1`,
            [universityId]
        );

        let percentage = 2;
        if (rows.length > 0) {
            percentage = parseFloat(rows[0].setting_value);
        }

        return success(res, { percentage });
    } catch (err) {
        console.error('Get service fee error:', err);
        next(err);
    }
};

const updateServiceFee = async (req, res, next) => {
    try {
        const { percentage } = req.body;
        const universityId = await getUserUniversity(req.user.id);

        if (!universityId) {
            return error(res, 'No university associated with your account', 400);
        }

        if (percentage === undefined || percentage < 0 || percentage > 100) {
            return error(res, 'Percentage must be between 0 and 100', 400);
        }

        await query(
            `INSERT INTO system_settings (setting_key, setting_value, setting_type, updated_at, updated_by, university_id)
             VALUES ('service_fee_percentage', $1, 'number', NOW(), $2, $3)
             ON CONFLICT (setting_key, university_id)
             DO UPDATE SET setting_value = EXCLUDED.setting_value,
                           setting_type = EXCLUDED.setting_type,
                           updated_at = NOW(),
                           updated_by = EXCLUDED.updated_by`,
            [percentage.toString(), req.user?.id, universityId]
        );

        return success(res, { percentage }, 'Service fee updated');
    } catch (err) {
        console.error('Update service fee error:', err);
        next(err);
    }
};

const getActivePaymentMethod = async (req, res, next) => {
    try {
        const vendorId = req.params.vendorId || req.user.id;
        const universityId = await getUserUniversity(vendorId);

        if (!universityId) {
            return success(res, null, 'No active payment method found');
        }

        const { rows } = await query(
            `SELECT * FROM vendor_payment_methods WHERE vendor_id = $1 AND university_id = $2 AND is_active = true ORDER BY is_default DESC, created_at DESC LIMIT 1`,
            [vendorId, universityId]
        );

        return success(res, rows[0] || null);
    } catch (err) {
        console.error('Get active payment method error:', err);
        next(err);
    }
};

const getActivePaymentMethodByUniversity = async (req, res, next) => {
    try {
        const { university_id } = req.query;

        if (!university_id) {
            return error(res, 'University ID is required', 400);
        }

        const { rows } = await query(
            `SELECT vpm.* FROM vendor_payment_methods vpm
             JOIN users u ON vpm.vendor_id = u.id
             WHERE u.university_id = $1 AND vpm.is_active = true
             ORDER BY vpm.is_default DESC, vpm.created_at DESC
             LIMIT 1`,
            [university_id]
        );

        if (!rows[0]) {
            return success(res, null, 'No active payment method found for this university');
        }

        return success(res, rows[0]);
    } catch (err) {
        console.error('Get active payment method by university error:', err);
        next(err);
    }
};

const getAllPaymentMethodsByUniversity = async (req, res, next) => {
    try {
        const { university_id } = req.query;

        if (!university_id) {
            return error(res, 'University ID is required', 400);
        }

        const { rows } = await query(
            `SELECT vpm.* FROM vendor_payment_methods vpm
             JOIN users u ON vpm.vendor_id = u.id
             WHERE u.university_id = $1 AND vpm.is_active = true
             ORDER BY vpm.is_default DESC, vpm.created_at DESC`,
            [university_id]
        );

        return success(res, rows);
    } catch (err) {
        console.error('Get all payment methods by university error:', err);
        next(err);
    }
};

const initiatePayment = async (req, res, next) => {
    try {
        const { order_id, phone_number, payment_method_id } = req.body;

        // Get order with vendor and university info
        const { rows: [order] } = await query(
            `SELECT o.*, u.id as vendor_id, o.university_id
             FROM orders o
             JOIN users u ON o.vendor_id = u.id
             WHERE o.id = $1`,
            [order_id]
        );
        if (!order) return notFound(res, 'Order not found');
        if (order.status !== 'pending') return error(res, `Order is already ${order.status}`);

        // Get vendor's active payment method
        const { rows: [paymentMethod] } = await query(
            `SELECT * FROM vendor_payment_methods
             WHERE id = $1 AND is_active = true`,
            [payment_method_id]
        );

        if (!paymentMethod) {
            return error(res, 'Vendor has no active payment method configured', 400);
        }

        // Create payment record - NO transaction_id generated here (will be provided by user)
        const { rows: [payment] } = await query(`
            INSERT INTO payments (order_id, provider, phone_number, amount, status, payment_method, university_id)
            VALUES ($1, $2, $3, $4, 'pending', $5, $6)
            RETURNING *
        `, [order_id, paymentMethod.provider, phone_number, order.total, paymentMethod.method_type, order.university_id]);

        // Create transaction record - NO transaction_code auto-generated
        const { rows: [transaction] } = await query(`
            INSERT INTO transactions (order_id, vendor_id, customer_id, university_id, amount, phone_number, provider, payment_method, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending')
            RETURNING *
        `, [order_id, order.vendor_id, req.user.id, order.university_id, order.total, phone_number, paymentMethod.provider, paymentMethod.method_type]);

        logger.info(`Payment initiated: ${payment.id} for order ${order_id} using ${paymentMethod.method_type} (${paymentMethod.provider})`);

        // For Lipa (manual) - return instructions for user to pay and enter transaction ID
        if (paymentMethod.method_type === 'lipa') {
            return success(res, {
                payment_id: payment.id,
                transaction_id: transaction.id,
                order_id,
                provider: paymentMethod.provider,
                amount: order.total,
                payment_flow: 'manual',
                status: 'pending',
                payment_instructions: {
                    lipa_number: paymentMethod.lipa_number,
                    account_name: paymentMethod.account_name,
                    message: `Please send ${order.total} TZS to ${paymentMethod.provider} number ${paymentMethod.lipa_number}`
                },
                message: `Please complete payment to ${paymentMethod.lipa_number} and then enter your transaction ID below.`
            });
        } else {
            // STK Push flow - automated
            logger.info(`STK Push simulation: ${paymentMethod.provider} - ${phone_number} - TZS ${order.total}`);

            // Simulate callback after 5 seconds
            setTimeout(async () => {
                try {
                    await query(`
                        UPDATE payments SET status = 'success', completed_at = NOW() WHERE id = $1
                    `, [payment.id]);
                    await query(`
                        UPDATE transactions SET status = 'success', updated_at = NOW() WHERE id = $1
                    `, [transaction.id]);
                    await query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [order_id]);

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
                        INSERT INTO qr_tokens (order_id, token, qr_image_url, expires_at, university_id)
                        VALUES ($1, $2, $3, $4, $5)
                    `, [order_id, token, qrImage, expiresAt, order.university_id]);

                    logger.info(`STK Push payment confirmed for order ${order_id}`);
                } catch (err) {
                    logger.error('STK Push callback error:', err);
                }
            }, 5000);

            return success(res, {
                payment_id: payment.id,
                transaction_id: transaction.id,
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

const confirmManualPayment = async (req, res, next) => {
    try {
        const { transaction_id, transaction_code, phone_number } = req.body;

        // Validate input
        if (!transaction_code || transaction_code.trim() === '') {
            return error(res, 'Transaction code is required', 400);
        }

        // Check if transaction code already exists
        const { rows: existingTransaction } = await query(
            `SELECT id, transaction_code, status FROM transactions
             WHERE transaction_code = $1`,
            [transaction_code]
        );

        if (existingTransaction.length > 0) {
            return error(res, 'This transaction code has already been used. Please check your payment status or contact support.', 409);
        }

        // Find transaction
        const { rows: [transaction] } = await query(
            `SELECT t.*, o.id as order_id, o.status as order_status, o.university_id
             FROM transactions t
             JOIN orders o ON t.order_id = o.id
             WHERE t.id = $1`,
            [transaction_id]
        );

        if (!transaction) return notFound(res, 'Transaction not found');

        if (transaction.status !== 'pending') {
            return error(res, `Payment already ${transaction.status}`, 400);
        }

        // Update transaction with user-provided transaction_code
        await query(
            `UPDATE transactions
             SET status = 'pending_verification',
                 transaction_code = $1,
                 phone_number = COALESCE($2, phone_number),
                 updated_at = NOW()
             WHERE id = $3`,
            [transaction_code, phone_number, transaction.id]
        );

        // Update payment record with transaction_id - REMOVED updated_at reference
        await query(
            `UPDATE payments
             SET status = 'pending_verification',
                 transaction_id = $1
             WHERE order_id = $2`,
            [transaction_code, transaction.order_id]
        );

        // Update order status
        await query(
            `UPDATE orders SET status = 'pending_verification', updated_at = NOW() WHERE id = $1`,
            [transaction.order_id]
        );

        logger.info(`Manual payment confirmation submitted for transaction ${transaction_code}`);

        return success(res, {
            transaction_id: transaction.id,
            transaction_code: transaction_code,
            status: 'pending_verification',
            message: 'Payment confirmation submitted. Waiting for vendor verification.'
        });
    } catch (err) {
        logger.error('Confirm manual payment error:', err);
        next(err);
    }
};

const verifyPayment = async (req, res, next) => {
    try {
        // IMPROVEMENT: Accept either transaction_id OR transaction_code
        const { transaction_id, transaction_code, is_verified, notes } = req.body;
        const vendorId = req.user.id;
        const universityId = req.user.university_id;

        // Build query based on what's provided
        let transactionQuery = `
            SELECT t.*, o.vendor_id, o.university_id, o.id as order_id, o.status as order_status
            FROM transactions t
            JOIN orders o ON t.order_id = o.id
            WHERE o.university_id = $1 AND (1=2`; // False by default
        let params = [universityId];
        let paramIndex = 2;

        if (transaction_id) {
            transactionQuery += ` OR t.id = $${paramIndex}`;
            params.push(transaction_id);
            paramIndex++;
        }
        if (transaction_code) {
            transactionQuery += ` OR t.transaction_code = $${paramIndex}`;
            params.push(transaction_code);
            paramIndex++;
        }
        transactionQuery += `) LIMIT 1`;

        const { rows: [transaction] } = await query(transactionQuery, params);

        if (!transaction) {
            return notFound(res, 'Transaction not found or not authorized');
        }

        // Verify vendor authorization
        if (transaction.vendor_id !== vendorId && req.user.role !== 'admin') {
            return error(res, 'Not authorized to verify this transaction', 403);
        }

        // Check transaction status
        if (transaction.status !== 'pending_verification') {
            return error(res, `Cannot verify payment. Current status: ${transaction.status}`, 400);
        }

        // IMPROVEMENT: Check order status before allowing verification
        if (transaction.order_status !== 'pending_verification') {
            return error(res, `Order status is ${transaction.order_status}. Cannot verify payment.`, 400);
        }

        if (is_verified) {
            const result = await withTransaction(async (client) => {
                // Update transaction to success
                await client.query(
                    `UPDATE transactions
                     SET status = 'success',
                         verified_by = $1,
                         verified_at = NOW(),
                         notes = COALESCE(notes, '') || '\n' || $2,
                         updated_at = NOW()
                     WHERE id = $3`,
                    [vendorId, `Verified by ${req.user.reg_number} on ${new Date().toISOString()}`, transaction.id]
                );

                // IMPROVEMENT: Update orders table with transaction_code if not set
                await client.query(
                    `UPDATE orders
                     SET status = 'paid',
                         transaction_code = COALESCE(transaction_code, $1),
                         transaction_id = $2,
                         updated_at = NOW()
                     WHERE id = $3`,
                    [transaction.transaction_code, transaction.id, transaction.order_id]
                );

                // Update payment record if exists
                await client.query(
                    `UPDATE payments
                     SET status = 'success',
                         completed_at = NOW(),
                         provider_ref = COALESCE(provider_ref, $1)
                     WHERE order_id = $2`,
                    [transaction.transaction_code, transaction.order_id]
                );

                // IMPROVEMENT: Check if QR code already exists before generating new one
                const { rows: existingQR } = await client.query(
                    `SELECT id, token, expires_at FROM qr_tokens
                     WHERE order_id = $1 AND is_used = false AND expires_at > NOW()
                     ORDER BY created_at DESC LIMIT 1`,
                    [transaction.order_id]
                );

                let qrToken, qrImage, expiresAt;

                if (existingQR.length > 0) {
                    // Reuse existing QR code
                    qrToken = existingQR[0];
                    qrImage = existingQR[0].qr_image_url;
                    expiresAt = existingQR[0].expires_at;

                    logger.info(`Reusing existing QR code for order ${transaction.order_id}`);
                } else {
                    // Generate new QR code
                    qrToken = crypto.randomBytes(24).toString('hex');
                    const expiryMins = parseInt(process.env.QR_EXPIRY_MINUTES) || 30;
                    expiresAt = new Date(Date.now() + expiryMins * 60 * 1000);

                    const qrData = JSON.stringify({
                        order_id: transaction.order_id,
                        token: qrToken,
                        transaction_code: transaction.transaction_code,
                        exp: expiresAt.toISOString()
                    });

                    // IMPROVEMENT: Make QR generation async with timeout
                    qrImage = await Promise.race([
                        QRCode.toDataURL(qrData, {
                            errorCorrectionLevel: 'H',
                            margin: 2,
                            color: { dark: '#16120E', light: '#FFFFFF' },
                        }),
                        new Promise((_, reject) =>
                            setTimeout(() => reject(new Error('QR generation timeout')), 5000)
                        )
                    ]);

                    await client.query(
                        `INSERT INTO qr_tokens (order_id, token, qr_image_url, expires_at, university_id)
                         VALUES ($1, $2, $3, $4, $5)`,
                        [transaction.order_id, qrToken, qrImage, expiresAt, transaction.university_id]
                    );
                }

                return {
                    transaction_id: transaction.id,
                    transaction_code: transaction.transaction_code,
                    qr_token: qrToken,
                    qr_image_url: qrImage,
                    expires_at: expiresAt
                };
            });

            logger.info(`Payment verified for transaction ${transaction.transaction_code} by ${req.user.reg_number}`);
            return success(res, result, 'Payment verified successfully. QR code ready for pickup.');

        } else {
            // Mark as failed
            await query(
                `UPDATE transactions
                 SET status = 'failed',
                     verified_by = $1,
                     notes = $2,
                     updated_at = NOW()
                 WHERE id = $3`,
                [vendorId, notes || `Payment verification failed by ${req.user.reg_number}`, transaction.id]
            );

            // Update order status to cancelled if verification failed
            await query(
                `UPDATE orders
                 SET status = 'cancelled',
                     updated_at = NOW()
                 WHERE id = $1 AND status = 'pending_verification'`,
                [transaction.order_id]
            );

            logger.warn(`Payment verification failed for transaction ${transaction.transaction_code}`);
            return success(res, {
                transaction_id: transaction.id,
                status: 'failed',
                message: 'Payment verification failed'
            });
        }
    } catch (err) {
        logger.error('Verify payment error:', err);
        if (err.message === 'QR generation timeout') {
            return error(res, 'QR code generation timed out. Please try again.', 504);
        }
        next(err);
    }
};

const confirmPayment = async (req, res, next) => {
    try {
        // IMPROVEMENT: Better validation
        const { payment_id, provider_ref, status = 'success', transaction_code, order_id } = req.body;

        if (!payment_id && !order_id) {
            return error(res, 'Either payment_id or order_id is required', 400);
        }

        const result = await withTransaction(async (client) => {
            let payment;

            // IMPROVEMENT: Find payment by ID or order_id
            if (payment_id) {
                const { rows: [foundPayment] } = await client.query(
                    `SELECT * FROM payments WHERE id = $1`,
                    [payment_id]
                );
                payment = foundPayment;
            } else if (order_id) {
                const { rows: [foundPayment] } = await client.query(
                    `SELECT * FROM payments WHERE order_id = $1 ORDER BY initiated_at DESC LIMIT 1`,
                    [order_id]
                );
                payment = foundPayment;
            }

            if (!payment) {
                throw Object.assign(new Error('Payment not found'), { statusCode: 404 });
            }

            // IMPROVEMENT: Check if payment already processed
            if (payment.status !== 'pending') {
                return {
                    payment,
                    qr: null,
                    message: `Payment already ${payment.status}`
                };
            }

            // Update payment
            const { rows: [updatedPayment] } = await client.query(`
                UPDATE payments
                SET status = $1,
                    provider_ref = $2,
                    completed_at = NOW()
                WHERE id = $3
                RETURNING *
            `, [status, provider_ref || payment.provider_ref || 'WEBHOOK', payment.id]);

            // IMPROVEMENT: Better transaction handling
            let transaction = null;
            if (transaction_code) {
                // Try to find existing transaction
                const { rows: [existingTransaction] } = await client.query(
                    `SELECT * FROM transactions WHERE transaction_code = $1 AND order_id = $2`,
                    [transaction_code, payment.order_id]
                );

                if (existingTransaction) {
                    // Update existing transaction
                    const { rows: [updatedTransaction] } = await client.query(`
                        UPDATE transactions
                        SET status = $1,
                            provider_reference = $2,
                            verified_by = $3,
                            verified_at = NOW(),
                            updated_at = NOW()
                        WHERE id = $4
                        RETURNING *
                    `, [
                        status === 'success' ? 'success' : 'failed',
                        provider_ref,
                        req.user?.id || null,
                        existingTransaction.id
                    ]);
                    transaction = updatedTransaction;
                } else if (status === 'success') {
                    // Create new transaction record
                    const { rows: [orderData] } = await client.query(
                        `SELECT vendor_id, university_id, user_id, total FROM orders WHERE id = $1`,
                        [payment.order_id]
                    );

                    const { rows: [newTransaction] } = await client.query(`
                        INSERT INTO transactions (
                            order_id, vendor_id, customer_id, university_id,
                            amount, transaction_code, provider, payment_method,
                            status, provider_reference
                        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
                        RETURNING *
                    `, [
                        payment.order_id,
                        orderData.vendor_id,
                        orderData.user_id,
                        orderData.university_id,
                        orderData.total,
                        transaction_code,
                        updatedPayment.provider || 'mpesa',
                        'mobile_money',
                        'success',
                        provider_ref
                    ]);
                    transaction = newTransaction;
                }
            }

            // Update order status based on payment result
            if (status !== 'success') {
                await client.query(
                    `UPDATE orders SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
                    [payment.order_id]
                );
                return { payment: updatedPayment, transaction, qr: null, message: 'Payment failed' };
            }

            // IMPROVEMENT: Update order with transaction info
            if (transaction && transaction.transaction_code) {
                await client.query(
                    `UPDATE orders
                     SET status = 'paid',
                         transaction_code = COALESCE(transaction_code, $1),
                         transaction_id = $2,
                         updated_at = NOW()
                     WHERE id = $3
                     AND status != 'paid'`,
                    [transaction.transaction_code, transaction.id, payment.order_id]
                );
            } else {
                await client.query(
                    `UPDATE orders SET status = 'paid', updated_at = NOW()
                     WHERE id = $1 AND status != 'paid'`,
                    [payment.order_id]
                );
            }

            // IMPROVEMENT: Check for existing valid QR before generating new one
            const { rows: existingQR } = await client.query(
                `SELECT * FROM qr_tokens
                 WHERE order_id = $1 AND is_used = false AND expires_at > NOW()
                 ORDER BY created_at DESC LIMIT 1`,
                [payment.order_id]
            );

            if (existingQR.length > 0) {
                logger.info(`Reusing existing QR for order ${payment.order_id}`);
                return {
                    payment: updatedPayment,
                    transaction,
                    qr: existingQR[0],
                    message: 'Payment confirmed (existing QR reused)'
                };
            }

            // Generate fresh QR code
            const token = crypto.randomBytes(24).toString('hex');
            const expiryMins = parseInt(process.env.QR_EXPIRY_MINUTES) || 30;
            const expiresAt = new Date(Date.now() + expiryMins * 60 * 1000);

            const qrData = JSON.stringify({
                order_id: payment.order_id,
                token,
                transaction_code: transaction?.transaction_code || null,
                exp: expiresAt.toISOString()
            });

            const qrImage = await QRCode.toDataURL(qrData, {
                errorCorrectionLevel: 'H',
                margin: 2,
                color: { dark: '#16120E', light: '#FFFFFF' },
            });

            const { rows: [qr] } = await client.query(`
                INSERT INTO qr_tokens (order_id, token, qr_image_url, expires_at, university_id)
                VALUES ($1, $2, $3, $4,
                    (SELECT university_id FROM orders WHERE id = $1)
                )
                RETURNING *
            `, [payment.order_id, token, qrImage, expiresAt]);

            logger.info(`Payment confirmed: ${payment.id} → Order ${payment.order_id} QR generated`);
            return { payment: updatedPayment, transaction, qr, message: 'Payment confirmed successfully' };
        });

        return success(res, result, result.message);
    } catch (err) {
        logger.error('Confirm payment error:', err);
        if (err.statusCode) return error(res, err.message, err.statusCode);
        next(err);
    }
};

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
    getActivePaymentMethodByUniversity,
    getAllPaymentMethodsByUniversity,
    getServiceFee,
    updateServiceFee,
    confirmManualPayment,
    verifyPayment,
    getVendorTransactions,
    getPaymentStatus
};