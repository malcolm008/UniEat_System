const { query, withTransaction } = require('../../../shared/db/db');
const { success, created, notFound, error, paginate } = require('../../../shared/utils/response');
const { logger } = require('../../../shared/utils/logger');

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
      where += ` AND (u.name ILIKE $${idx} OR u.reg_number ILIKE $${idx} OR o.guest_name ILIKE $${idx} OR CAST(o.id AS TEXT) ILIKE $${idx})`;
      params.push(`%${search}%`); idx++;
    }

    const countSql = `SELECT COUNT(*) FROM orders o LEFT JOIN users u ON u.id = o.user_id ${where}`;
    const ordersSql = `
      SELECT
        o.*,
        COALESCE(u.name, o.guest_name, 'Guest') AS customer_name,
        COALESCE(u.reg_number, '—') AS reg_number,
        u.role AS customer_role,
        o.transaction_code,
        t.provider AS transaction_provider,
        t.status AS transaction_verification_status,
        (SELECT json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'subtotal', oi.subtotal))
         FROM order_items oi WHERE oi.order_id = o.id) AS items,
        (SELECT p.provider FROM payments p WHERE p.order_id = o.id ORDER BY p.initiated_at DESC LIMIT 1) AS payment_provider,
        (SELECT p.status  FROM payments p WHERE p.order_id = o.id ORDER BY p.initiated_at DESC LIMIT 1) AS payment_status
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
      LEFT JOIN transactions t ON t.order_id = o.id AND t.status = 'success'
      ${where}
      ORDER BY o.created_at DESC
      LIMIT $${idx++} OFFSET $${idx}
    `;

    const [countRes, ordersRes] = await Promise.all([
      query(countSql, params),
      query(ordersSql, [...params, limit, offset]),
    ]);

    return paginate(res, ordersRes.rows, parseInt(countRes.rows[0].count), page, limit);
  } catch (err) { next(err); }
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
            COALESCE(p.provider, 'pending') as payment_provider,
            COALESCE(p.status, 'pending') as payment_status,
            p.transaction_id as transaction_code,
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
            ) AS items
          FROM orders o
          LEFT JOIN payments p ON p.order_id = o.id
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
            LIMIT 10
        `, [req.user.id, universityId]);

        return success(res, rows);
    } catch (err) {
        console.error('Get my orders error:', err);
        next(err);
    }
};

const getOrder = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT o.*,
        COALESCE(u.name, o.guest_name, 'Guest') AS customer_name,
        COALESCE(u.reg_number, '—') AS reg_number,
        (SELECT json_agg(oi.*) FROM order_items oi WHERE oi.order_id = o.id) AS items,
        (SELECT json_agg(p.*) FROM payments p WHERE p.order_id = o.id) AS payments,
        (SELECT json_build_object('token', q.token, 'is_used', q.is_used, 'expires_at', q.expires_at)
         FROM qr_tokens q WHERE q.order_id = o.id ORDER BY q.created_at DESC LIMIT 1) AS qr
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
    const valid = ['pending','paid','preparing','ready','served','cancelled'];
    if (!valid.includes(status)) return error(res, `Status must be one of: ${valid.join(', ')}`);

    const { rows } = await query(
      'UPDATE orders SET status = $1 WHERE id = $2 RETURNING id, status, updated_at',
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
        COUNT(*) FILTER (WHERE DATE(o.created_at) = $1 AND o.status = 'served')   AS served_today,
        COALESCE(SUM(o.total) FILTER (WHERE DATE(o.created_at) = $1 AND o.status NOT IN ('cancelled','refunded')), 0) AS revenue_today,
        COALESCE(SUM(o.total) FILTER (WHERE DATE_TRUNC('week', o.created_at) = DATE_TRUNC('week', $1::date) AND o.status NOT IN ('cancelled','refunded')), 0) AS revenue_week,
        COALESCE(AVG(o.total) FILTER (WHERE DATE(o.created_at) = $1), 0) AS avg_order_value
      FROM orders o
    `, [d]);

    // Top selling items
    const { rows: topItems } = await query(`
      SELECT oi.name, SUM(oi.quantity) AS total_qty, SUM(oi.subtotal) AS total_revenue
      FROM order_items oi
      JOIN orders o ON o.id = oi.order_id
      WHERE DATE(o.created_at) = $1 AND o.status NOT IN ('cancelled','refunded')
      GROUP BY oi.name ORDER BY total_qty DESC LIMIT 5
    `, [d]);

    // Payment method breakdown
    const { rows: payBreakdown } = await query(`
      SELECT p.provider, COUNT(*) AS count, SUM(p.amount) AS total
      FROM payments p JOIN orders o ON o.id = p.order_id
      WHERE DATE(o.created_at) = $1 AND p.status = 'success'
      GROUP BY p.provider
    `, [d]);

    // Weekly revenue chart
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
        const { order_id, qr_code_url, transaction_code } = req.body;
        const universityId = req.user.university_id;

        const existingQR = await query(
            `SELECT id FROM qr_codes WHERE order_id = $1`,
            [order_id]
        );

        if (existingQR.rows.length > 0) {
            return error(res, 'QR code already generated for this order', 400);
        }

        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);

        const { rows } = await query(
            `INSERT INTO qr_codes (order_id, qr_image_url, token, expires_at, university_id) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
            [order_id, qr_code_url, transaction_code, expiresAt, universityId]
        );

        return success(res, rows[0], 'QR code generated');
    } catch (err) {
        next(err);
    }
};

const getOrderQR = async (req, res, next) => {
    try {
        const { orderId } = req.params;
        const userId = req.user.id;

        const { rows } = await query(
            `SELECT q.* FROM qr_codes q
             JOIN orders o ON q.order_id = o.id
             WHERE q.order_id = $1 AND o.user_id = $2 AND q.is_used = false AND q.expires_at > NOW()
             ORDER BY q.created_at DESC LIMIT 1`,
            [orderId, userId]
        );

        if (!rows[0]) {
            return success(res, null, 'No active QR code found');
        }

        return success(res, rows[0]);
    } catch (err) {
        next(err);
    }
};

const redeemQr = async (req, res, next) => {
    try {
        const { token } = req.body;
        const vendorId = req.user.id;

        const { rows: [qr] } = await query(
            `SELECT q.*, o.vendor_id, o.id as order_id
             FROM qr_codes q
             JOIN orders o ON q.order_id = o.id
             WHERE q.token = $1 AND q.is_used = false AND q.expires_at > NOW()`,
            [token]
        );

        if (!qr) return error(res, 'Invalid or expired QR code', 404);

        if (qr.vendor_id !== vendorId && req.user.role !== 'admin') {
            return error(res, 'Unauthorized to redeem this QR code', 403);
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

        return success(res, { order_id: qr.order_id }, 'Order marked as served');
    } catch (err) {
        next(err);
    }
};

const verifyOrderWithTransaction = async (req, res, next) => {
    try {
        const { order_id, transaction_id, is_verified, notes } = req.body;
        const verifierId = req.user.id;

        if (!is_verified) {
            return error(res, 'Verification failed', 400);
        }

        const result = await withTransaction(async (client) => {
            const { rows: [order] } = await client.query(`
                UPDATE orders SET status = 'pending_verification',
                    transaction_code = $1,
                    updated_at = NOW()
                WHERE id = $2
                RETURNING *
            `, [transaction_code, order_id]);

            if (!order) throw new Error('Order not found');

            const { rows: [transaction] } = await client.query(`
                INSERT INTO transactions (
                    order_id, vendor_id, customer_id, university_id,
                    amount, transaction_code, status, verified_by, verified_at, notes
                )
                SELECT
                    $1, o.vendor_id, o.user_id, o.university_id,
                    o.total, $2, 'success', $3, NOW(), $4
                FROM orders o
                WHERE o.id = $1
                RETURNING *
            `, [order_id, transaction_code, verifierId, notes]);

            return { order, transaction };
        });

        logger.info(`Order ${order_id} verified with transaction ${transaction_code}`);
        return success(res, result, 'Order verified successfully');
    } catch (err) {
        next(err);
    }
};

module.exports = { createOrder, getOrders, getMyOrders, getOrder, updateStatus, getStats, generateOrderQR, getOrderQR, redeemQr, verifyOrderWithTransaction};