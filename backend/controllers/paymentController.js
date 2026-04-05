const { query, withTransaction } = require('../db/db');
const { success, created, notFound, error } = require('../utils/response');
const QRCode = require('qrcode');
const crypto = require('crypto');
const logger = require('../utils/logger');

// ── POST /payments/initiate ────────────────────────────────────
// Simulate mobile money STK push (replace with real Flutterwave SDK)
const initiatePayment = async (req, res, next) => {
  try {
    const { order_id, provider, phone_number } = req.body;

    const { rows: [order] } = await query('SELECT * FROM orders WHERE id = $1', [order_id]);
    if (!order) return notFound(res, 'Order not found');
    if (order.status !== 'pending') return error(res, `Order is already ${order.status}`);

    // Create payment record
    const { rows: [payment] } = await query(`
      INSERT INTO payments (order_id, provider, phone_number, amount, status)
      VALUES ($1, $2, $3, $4, 'processing')
      RETURNING *
    `, [order_id, provider, phone_number, order.total]);

    // ── SIMULATION ──────────────────────────────────────────────
    // In production: call Flutterwave / DPO Group API here
    // They send an STK push to the phone, then call your webhook
    // For now we auto-confirm after 3 seconds via a simulated callback
    // ────────────────────────────────────────────────────────────

    logger.info(`Payment initiated: ${payment.id} ${provider} ${phone_number} TZS ${order.total}`);

    return success(res, {
      payment_id: payment.id,
      order_id,
      provider,
      amount: order.total,
      status: 'processing',
      message: `STK push sent to ${phone_number}`,
    }, 'Payment initiated — check your phone');
  } catch (err) { next(err); }
};

// ── POST /payments/confirm — webhook / manual confirm ─────────
const confirmPayment = async (req, res, next) => {
  try {
    const { payment_id, provider_ref, status = 'success' } = req.body;

    const result = await withTransaction(async (client) => {
      // Update payment
      const { rows: [payment] } = await client.query(`
        UPDATE payments SET status = $1, provider_ref = $2, completed_at = NOW()
        WHERE id = $3 RETURNING *
      `, [status, provider_ref || 'SIMULATED', payment_id]);
      if (!payment) throw Object.assign(new Error('Payment not found'), { statusCode: 404 });

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

module.exports = { initiatePayment, confirmPayment, verifyQR, redeemQR, getQR };