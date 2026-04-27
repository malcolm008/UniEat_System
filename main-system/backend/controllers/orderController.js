const { query, withTransaction } = require('../../../shared/db/db');
const { success, created, notFound, error, paginate } = require('../../../shared/utils/response');
const { logger } = require('../../../shared/utils/logger');
const QRCode = require('qrcode');
const crypto = require('crypto');

const createOrder = async (req, res, next) => {
  try {
    const { items, guest_name, guest_phone, notes, university_id, transaction_code } = req.body;
    if (!items?.length) return error(res, 'Order must contain at least one item');

    let finalUniversityId = university_id || req.user?.university_id;

    if (!finalUniversityId && items.length > 0) {
      const firstItemId = items[0].menu_item_id;
      const { rows: itemRows } = await query(
        `SELECT university_id FROM menu_items WHERE id = $1`,
        [firstItemId]
      );
      if (itemRows[0]) {
        finalUniversityId = itemRows[0].university_id;
      }
    }

    if (!finalUniversityId) {
      return error(res, 'Unable to determine university for this order', 400);
    }

    const { rows: vendorRows } = await query(
      `SELECT vendor_id FROM vendor_payment_methods
       WHERE university_id = $1 AND is_active = true
       LIMIT 1`,
      [finalUniversityId]
    );

    const vendorId = vendorRows.length > 0 ? vendorRows[0].vendor_id : null;

    const { rows: feeRows } = await query(
      `SELECT setting_value FROM system_settings
       WHERE setting_key = 'service_fee_percentage' AND university_id = $1`,
      [finalUniversityId]
    );
    const serviceFeePercentage = feeRows.length > 0 ? parseFloat(feeRows[0].setting_value) : 2;

    const result = await withTransaction(async (client) => {
      const ids = items.map(i => i.menu_item_id);
      const { rows: menuItems } = await client.query(
        `SELECT id, name, price, is_available FROM menu_items WHERE id = ANY($1::uuid[]) AND university_id = $2`,
        [ids, finalUniversityId]
      );

      if (menuItems.length !== ids.length) {
        throw new Error('Some items are not available in this university');
      }

      const itemMap = menuItems.reduce((m, i) => ({ ...m, [i.id]: i }), {});
      let subtotal = 0;
      const orderLines = [];

      for (const item of items) {
        const mi = itemMap[item.menu_item_id];
        if (!mi) throw Object.assign(new Error(`Item ${item.menu_item_id} not found`), { statusCode: 400 });
        if (!mi.is_available) throw Object.assign(new Error(`"${mi.name}" is not available`), { statusCode: 400 });
        const lineTotal = mi.price * item.quantity;
        subtotal += lineTotal;
        orderLines.push({
          menu_item_id: mi.id,
          name: mi.name,
          quantity: item.quantity,
          unit_price: mi.price,
          subtotal: lineTotal
        });
      }

      const service_charge = Math.round(subtotal * (serviceFeePercentage / 100));
      const total = subtotal + service_charge;

      const { rows: [order] } = await client.query(`
        INSERT INTO orders (user_id, vendor_id, university_id, guest_name, guest_phone, status, subtotal, service_charge, total, notes, transaction_code)
        VALUES ($1, $2, $3, $4, $5, 'pending', $6, $7, $8, $9, $10)
        RETURNING *
      `, [req.user?.id || null, vendorId, finalUniversityId, guest_name || null, guest_phone || null, subtotal, service_charge, total, notes || null, transaction_code || null]);

      for (const line of orderLines) {
        await client.query(`
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, subtotal)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [order.id, line.menu_item_id, line.name, line.quantity, line.unit_price, line.subtotal]);
      }

      return { order, orderLines };
    });

    logger.info(`Order created: ${result.order.id} total=${result.order.total} for university ${finalUniversityId}`);
    return created(res, result.order, 'Order created');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

const getOrders = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, date, search } = req.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (status) { where += ` AND o.status = $${idx++}`; params.push(status); }
    if (date)   { where += ` AND DATE(o.created_at) = $${idx++}`; params.push(date); }
    if (search) {
      where += ` AND (u.name ILIKE $${idx} OR u.reg_number ILIKE $${idx} OR o.guest_name ILIKE $${idx} OR t.transaction_code ILIKE $${idx} OR CAST(o.id AS TEXT) ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }

    const countSql = `SELECT COUNT(*) FROM orders o LEFT JOIN users u ON u.id = o.user_id LEFT JOIN transactions t ON t.order_id = o.id ${where}`;

    const ordersSql = `
      SELECT
        o.*,
        COALESCE(u.name, o.guest_name, 'Guest') AS customer_name,
        COALESCE(u.reg_number, '—') AS reg_number,
        u.role AS customer_role,
        -- IMPORTANT: Get transaction_code from transactions table, not orders
        t.transaction_code,
        t.provider AS transaction_provider,
        t.status AS transaction_verification_status,
        t.id as transaction_id,
        (SELECT json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'subtotal', oi.subtotal))
         FROM order_items oi WHERE oi.order_id = o.id) AS items,
        (SELECT p.provider FROM payments p WHERE p.order_id = o.id ORDER BY p.initiated_at DESC LIMIT 1) AS payment_provider,
        (SELECT p.status  FROM payments p WHERE p.order_id = o.id ORDER BY p.initiated_at DESC LIMIT 1) AS payment_status,
        (SELECT q.qr_image_url FROM qr_codes q WHERE q.order_id = o.id AND q.is_used = false AND q.expires_at > NOW() ORDER BY q.created_at DESC LIMIT 1) AS qr_code_url
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN transactions t ON t.order_id = o.id  -- This join is critical!
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${idx++} OFFSET $${idx}
    `;

    const [countRes, ordersRes] = await Promise.all([
      query(countSql, params),
      query(ordersSql, [...params, limit, offset]),
    ]);

    return paginate(res, ordersRes.rows, parseInt(countRes.rows[0].count), page, limit);
  } catch (err) {
    logger.error('Get orders error:', err);
    next(err);
  }
};

const getMyOrders = async (req, res, next) => {
    try {
        const universityId = req.user.university_id;

        if (!universityId) {
            return error(res, 'No university associated with your account', 400);
        }

        const { rows } = await query(`
          SELECT
            o.id,
            o.status,
            o.subtotal,
            o.service_charge,
            o.total,
            o.created_at,
            o.updated_at,
            t.transaction_code,
            t.provider AS transaction_provider,
            t.status AS transaction_status,
            COALESCE(p.provider, 'pending') as payment_provider,
            COALESCE(p.status, 'pending') as payment_status,
            (
              SELECT json_agg(
                json_build_object(
                  'name', oi.name,
                  'quantity', oi.quantity,
                  'unit_price', oi.unit_price,
                  'subtotal', oi.subtotal
                )
              )
              FROM order_items oi
              WHERE oi.order_id = o.id
            ) AS items,
            (
              SELECT q.qr_image_url FROM qr_codes q
              WHERE q.order_id = o.id AND q.is_used = false AND q.expires_at > NOW()
              ORDER BY q.created_at DESC LIMIT 1
            ) AS qr_code_url
          FROM orders o
          LEFT JOIN payments p ON p.order_id = o.id
          LEFT JOIN transactions t ON t.order_id = o.id  -- Add this join!
          WHERE o.user_id = $1 AND o.university_id = $2
          ORDER BY
            CASE o.status
              WHEN 'pending' THEN 1
              WHEN 'pending_verification' THEN 2
              WHEN 'paid' THEN 3
              WHEN 'preparing' THEN 4
              WHEN 'ready' THEN 5
              WHEN 'served' THEN 6
              WHEN 'completed' THEN 7
              WHEN 'cancelled' THEN 8
              ELSE 9
            END,
            o.created_at DESC
        `, [req.user.id, universityId]);

        return success(res, rows);
    } catch (err) {
        logger.error('Get my orders error:', err);
        next(err);
    }
};

const getOrder = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT o.*,
        COALESCE(u.name, o.guest_name, 'Guest') AS customer_name,
        COALESCE(u.reg_number, '—') AS reg_number,
        o.transaction_code,
        (SELECT json_agg(oi.*) FROM order_items oi WHERE oi.order_id = o.id) AS items,
        (SELECT json_agg(p.*) FROM payments p WHERE p.order_id = o.id) AS payments,
        (SELECT json_build_object('token', q.token, 'is_used', q.is_used, 'expires_at', q.expires_at, 'qr_image_url', q.qr_image_url)
         FROM qr_codes q WHERE q.order_id = o.id ORDER BY q.created_at DESC LIMIT 1) AS qr
      FROM orders o LEFT JOIN users u ON u.id = o.user_id
      WHERE o.id = $1
    `, [req.params.id]);
    if (!rows[0]) return notFound(res, 'Order not found');
    return success(res, rows[0]);
  } catch (err) { next(err); }
};

const updateStatus = async (req, res, next) => {
  try {
    const { status } = req.body;
    const valid = ['pending', 'pending_verification', 'paid', 'preparing', 'ready', 'served', 'completed', 'cancelled', 'refunded'];
    if (!valid.includes(status)) return error(res, `Status must be one of: ${valid.join(', ')}`);

    const { rows } = await query(
      'UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING id, status, updated_at',
      [status, req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Order not found');
    logger.info(`Order ${req.params.id} status → ${status} by ${req.user.reg_number}`);
    return success(res, rows[0], 'Order status updated');
  } catch (err) { next(err); }
};

const getStats = async (req, res, next) => {
  try {
    const { date } = req.query;
    const d = date || new Date().toISOString().split('T')[0];

    const { rows: [stats] } = await query(`
      SELECT
        COUNT(*) FILTER (WHERE DATE(o.created_at) = $1)                           AS orders_today,
        COUNT(*) FILTER (WHERE DATE(o.created_at) = $1 AND o.status = 'pending')  AS pending_today,
        COUNT(*) FILTER (WHERE DATE(o.created_at) = $1 AND o.status = 'pending_verification')  AS pending_verification_today,
        COUNT(*) FILTER (WHERE DATE(o.created_at) = $1 AND o.status = 'served')   AS served_today,
        COALESCE(SUM(o.total) FILTER (WHERE DATE(o.created_at) = $1 AND o.status NOT IN ('cancelled','refunded')), 0) AS revenue_today,
        COALESCE(SUM(o.total) FILTER (WHERE DATE_TRUNC('week', o.created_at) = DATE_TRUNC('week', $1::date) AND o.status NOT IN ('cancelled','refunded')), 0) AS revenue_week,
        COALESCE(AVG(o.total) FILTER (WHERE DATE(o.created_at) = $1), 0) AS avg_order_value
      FROM orders o
    `, [d]);

    const { rows: topItems } = await query(`
      SELECT oi.name, SUM(oi.quantity) AS total_qty, SUM(oi.subtotal) AS total_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE DATE(o.created_at) = $1 AND o.status NOT IN ('cancelled','refunded')
      GROUP BY oi.name ORDER BY total_qty DESC LIMIT 5
    `, [d]);

    const { rows: payBreakdown } = await query(`
      SELECT p.provider, COUNT(*) AS count, SUM(p.amount) AS total
      FROM payments p JOIN orders o ON o.id = p.order_id
      WHERE DATE(o.created_at) = $1 AND p.status = 'success'
      GROUP BY p.provider
    `, [d]);

    const { rows: weeklyRevenue } = await query(`
      SELECT DATE(o.created_at) AS date,
             COALESCE(SUM(o.total),0) AS revenue,
             COUNT(*) AS orders
      FROM orders o
      WHERE o.created_at >= NOW() - INTERVAL '7 days'
        AND o.status NOT IN ('cancelled','refunded')
      GROUP BY DATE(o.created_at)
      ORDER BY date
    `);

    return success(res, {
      today: { date: d, ...stats },
      top_items: topItems,
      payment_breakdown: payBreakdown,
      weekly_revenue: weeklyRevenue,
    });
  } catch (err) { next(err); }
};

const generateOrderQR = async (req, res, next) => {
    try {
        const { order_id, transaction_code } = req.body;
        const universityId = req.user.university_id;
        const userId = req.user.id;

        const HOVERCODE_WORKSPACE = process.env.HOVERCODE_WORKSPACE || '16d7f3bd-f8dd-46f4-9703-df9be3773efa';
        const HOVERCODE_TOKEN = process.env.HOVERCODE_TOKEN || '4d4d46f28f23480feaea8d175f2879a48aa92aab';

        logger.info(`Generating QR for order_id: ${order_id}, transaction_code: ${transaction_code}`);

        let orderQuery = `
            SELECT o.*, t.transaction_code as txn_code, t.id as transaction_id
            FROM orders o
            LEFT JOIN transactions t ON t.order_id = o.id
            WHERE o.university_id = $1
        `;
        let queryParams = [universityId];

        if (order_id) {
            orderQuery += ` AND o.id = $2`;
            queryParams.push(order_id);
        } else if (transaction_code) {
            orderQuery += ` AND (t.transaction_code = $2 OR o.transaction_code = $2)`;
            queryParams.push(transaction_code);
        } else {
            return error(res, 'Either order_id or transaction_code is required', 400);
        }

        orderQuery += ` LIMIT 1`;

        const { rows: [order] } = await query(orderQuery, queryParams);

        if (!order) {
            return error(res, 'Order not found', 404);
        }

        const isAuthorized = req.user.role === 'admin' || req.user.role === 'staff' || order.user_id === userId;

        if (order.status !== 'paid' && order.status !== 'ready' && order.status !== 'preparing') {
            return error(res, `QR codes can only be generated for paid orders. Current status: ${order.status}`, 400);
        }

        const { rows: existingQR } = await query(
            `SELECT id, qr_image_url, token, expires_at, hovercode_id
             FROM qr_codes
             WHERE order_id = $1 AND is_used = false AND expires_at > NOW()
             ORDER BY created_at DESC LIMIT 1`,
            [order.id]
        );

        if (existingQR.length > 0) {
            logger.info(`Returning existing QR code for order ${order.id}`);
            return success(res, {
                qr_code: existingQR[0],
                message: 'Existing valid QR code retrieved'
            }, 'QR code retrieved');
        }

        const qrData = JSON.stringify({
            order_id: order.id,
            transaction_code: order.txn_code || transaction_code,
            university_id: universityId,
            timestamp: new Date().toISOString(),
            is_used: false
        });

        const hovercodeResponse = await fetch('https://hovercode.com/api/v1/qr-codes', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${HOVERCODE_TOKEN}`
            },
            body: JSON.stringify({
                workspace_id: HOVERCODE_WORKSPACE,
                name: `Order_${order.id.slice(0,8)}_${order.txn_code || transaction_code}`,
                data: qrData,
                background_color: '#FFFFFF',
                foreground_color: '#C4522A',
                size: 400
            })
        });

        const hovercodeResult = await hovercodeResponse.json();

        if (!hovercodeResult.data || !hovercodeResult.data.qr_code_url) {
            logger.error('Hovercode API error:', hovercodeResult);
            throw new Error('Failed to generate QR code with Hovercode');
        }

        const qrImageUrl = hovercodeResult.data.qr_code_url;
        const hovercodeId = hovercodeResult.data.id;
        const token = crypto.randomBytes(32).toString('hex');
        const expiryHours = 24;
        const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

        const { rows: [qrCode] } = await query(
            `INSERT INTO qr_codes (order_id, qr_image_url, token, expires_at, university_id, hovercode_id, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, order_id, token, expires_at, created_at, is_used, hovercode_id`,
            [order.id, qrImageUrl, token, expiresAt, universityId, hovercodeId, userId]
        );

        logger.info(`Qr code generated via Hovercode for order ${order.id}, hovercode_id ${hovercodeId}`);

        return success(res, {
            qr_code: {
                ...qrCode,
                qr_image_url: qrImageUrl
            },
            expires_at: expiresAt,
            hovercode_id: hovercodeId,
            message: 'QR code generated successfully via Hovercode'
        }, 'QR code generated');
    } catch (err) {
        logger.error('QR generation error:', err);
        next(err);
    }
};

const getOrderQR = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;
        const universityId = req.user.university_id;

        const { rows: [order] } = await query(
            `SELECT id, status, user_id, transaction_code
             FROM orders
             WHERE id = $1 AND university_id = $2`,
            [orderId, universityId]
        );

        if (!order) {
            return error(res, 'Order not found', 404);
        }

        const isAuthorized = req.user.role === 'admin' ||
                            req.user.role === 'staff' ||
                            order.user_id === userId;

        if (!isAuthorized) {
            return error(res, 'Unauthorized to view this QR code', 403);
        }

        if (order.status === 'pending' || order.status === 'pending_verification') {
            return success(res, null, 'QR code will be available after payment verification');
        }

        if (order.status === 'cancelled') {
            return success(res, null, 'Order was cancelled. No QR code available.');
        }

        if (order.status === 'served' || order.status === 'completed') {
            return success(res, null, 'Order has already been served. QR code is no longer valid.');
        }

        // Get active QR code (match your schema)
        const { rows: [qrCode] } = await query(
            `SELECT id, qr_image_url, token, expires_at, is_used, created_at
             FROM qr_codes
             WHERE order_id = $1
             AND is_used = false
             AND expires_at > NOW()
             ORDER BY created_at DESC
             LIMIT 1`,
            [orderId]
        );

        if (!qrCode) {
            if (order.status === 'paid' || order.status === 'ready') {
                return success(res, null, 'QR code not yet generated. Please refresh or contact staff.');
            }
            return success(res, null, 'No active QR code found for this order');
        }

        return success(res, {
            id: qrCode.id,
            qr_image_url: qrCode.qr_image_url,
            token: qrCode.token,
            expires_at: qrCode.expires_at,
            is_used: qrCode.is_used,
            order_status: order.status
        }, 'QR code retrieved successfully');

    } catch (err) {
        logger.error('Get QR code error:', err);
        next(err);
    }
};

const regenerateOrderQR = async (req, res, next) => {
    try {
        const { order_id } = req.params;
        const userId = req.user.id;
        const universityId = req.user.university_id;

        const { rows: [order] } = await query(
            `SELECT o.*, t.transaction_code as txn_code
             FROM orders o
             LEFT JOIN transactions t ON t.order_id = o.id
             WHERE o.id = $1 AND o.university_id = $2`,
            [order_id, universityId]
        );

        if (!order) {
            return error(res, 'Order not found', 404);
        }

        const isAuthorized = req.user.role === 'admin' ||
                            req.user.role === 'staff' ||
                            order.user_id === userId;

        if (!isAuthorized) {
            return error(res, 'Unauthorized to regenerate QR for this order', 403);
        }

        if (order.status !== 'paid' && order.status !== 'ready') {
            return error(res, `Cannot regenerate QR for order with status: ${order.status}`, 400);
        }

        // Mark old QR codes as used
        await query(
            `UPDATE qr_codes
             SET is_used = true,
                 used_at = NOW(),
                 used_by = $1
             WHERE order_id = $2 AND is_used = false`,
            [userId, order_id]
        );

        // Generate new QR code
        const token = crypto.randomBytes(32).toString('hex');
        const expiryHours = 24;
        const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

        const qrPayload = {
            order_id: order.id,
            token: token,
            transaction_code: order.txn_code,
            university_id: universityId,
            expires_at: expiresAt.toISOString(),
            regenerated: true,
            previous_generated_at: order.updated_at
        };

        const qrData = JSON.stringify(qrPayload);
        const qrImageUrl = await QRCode.toDataURL(qrData, {
            errorCorrectionLevel: 'H',
            margin: 2,
            width: 300,
            color: { dark: '#C4522A', light: '#FFFFFF' }
        });

        // Match your actual schema (no created_by)
        const { rows: [qrCode] } = await query(
            `INSERT INTO qr_codes (order_id, qr_image_url, token, expires_at, university_id)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [order.id, qrImageUrl, token, expiresAt, universityId]
        );

        logger.info(`QR code regenerated for order ${order.id} by user ${userId}`);

        return success(res, {
            qr_code: qrCode,
            message: 'QR code regenerated successfully'
        }, 'QR code regenerated');

    } catch (err) {
        logger.error('QR regeneration error:', err);
        next(err);
    }
};

const redeemQr = async (req, res, next) => {
    try {
        const { token } = req.body;
        const vendorId = req.user.id;
        const universityId = req.user.university_id;

        const { rows: [qr] } = await query(
            `SELECT q.*, o.vendor_id, o.id as order_id, o.status as order_status
             FROM qr_codes q
             JOIN orders o ON q.order_id = o.id
             WHERE q.token = $1 AND q.is_used = false AND q.expires_at > NOW() AND o.university_id = $2`,
            [token, universityId]
        );

        if (!qr) return error(res, 'Invalid or expired QR code', 404);

        if (qr.vendor_id !== vendorId && req.user.role !== 'admin') {
            return error(res, 'Unauthorized to redeem this QR code', 403);
        }

        if (qr.order_status === 'served' || qr.order_status === 'completed') {
            return error(res, 'Order has already been served', 400);
        }

        await withTransaction(async (client) => {
            await client.query(
                `UPDATE qr_codes SET is_used = true, used_by = $1, used_at = NOW() WHERE id = $2`,
                [vendorId, qr.id]
            );

            await client.query(
                `UPDATE orders SET status = 'served', updated_at = NOW() WHERE id = $1`,
                [qr.order_id]
            );
        });

        logger.info(`QR code redeemed for order ${qr.order_id} by vendor ${vendorId}`);
        return success(res, { order_id: qr.order_id }, 'Order marked as served');
    } catch (err) {
        logger.error('Redeem QR error:', err);
        next(err);
    }
};


module.exports = {
    createOrder,
    getOrders,
    getMyOrders,
    getOrder,
    updateStatus,
    getStats,
    generateOrderQR,
    getOrderQR,
    regenerateOrderQR,
    redeemQr
};