const { query, withTransaction } = require('../../../shared/db/db');
const { success, created, notFound, error, paginate } = require('../../../shared/utils/response');
const { logger } = require('../../../shared/utils/logger');

// ── POST /orders — create order (student or guest) ─────────────
const createOrder = async (req, res, next) => {
  try {
    const { items, guest_name, guest_phone, notes } = req.body;
    if (!items?.length) return error(res, 'Order must contain at least one item');

    const result = await withTransaction(async (client) => {
      // Fetch menu items & validate
      const ids = items.map(i => i.menu_item_id);
      const { rows: menuItems } = await client.query(
        `SELECT id, name, price, is_available FROM menu_items WHERE id = ANY($1::uuid[])`,
        [ids]
      );

      const itemMap = menuItems.reduce((m, i) => ({ ...m, [i.id]: i }), {});
      let subtotal = 0;
      const orderLines = [];

      for (const item of items) {
        const mi = itemMap[item.menu_item_id];
        if (!mi) throw Object.assign(new Error(`Item ${item.menu_item_id} not found`), { statusCode: 400 });
        if (!mi.is_available) throw Object.assign(new Error(`"${mi.name}" is not available`), { statusCode: 400 });
        const lineTotal = mi.price * item.quantity;
        subtotal += lineTotal;
        orderLines.push({ menu_item_id: mi.id, name: mi.name, quantity: item.quantity, unit_price: mi.price, subtotal: lineTotal });
      }

      const service_charge = Math.round(subtotal * 0.02);
      const total = subtotal + service_charge;

      // Create order
      const { rows: [order] } = await client.query(`
        INSERT INTO orders (user_id, guest_name, guest_phone, status, subtotal, service_charge, total, notes)
        VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7)
        RETURNING *
      `, [req.user?.id || null, guest_name || null, guest_phone || null, subtotal, service_charge, total, notes || null]);

      // Insert order items
      for (const line of orderLines) {
        await client.query(`
          INSERT INTO order_items (order_id, menu_item_id, name, quantity, unit_price, subtotal)
          VALUES ($1, $2, $3, $4, $5, $6)
        `, [order.id, line.menu_item_id, line.name, line.quantity, line.unit_price, line.subtotal]);
      }

      return { order, orderLines };
    });

    logger.info(`Order created: ${result.order.id} total=${result.order.total}`);
    return created(res, result.order, 'Order created');
  } catch (err) {
    if (err.statusCode) return error(res, err.message, err.statusCode);
    next(err);
  }
};

// ── GET /orders — admin/staff: all orders with filters ─────────
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
        (SELECT json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity, 'unit_price', oi.unit_price, 'subtotal', oi.subtotal))
         FROM order_items oi WHERE oi.order_id = o.id) AS items,
        (SELECT p.provider FROM payments p WHERE p.order_id = o.id ORDER BY p.initiated_at DESC LIMIT 1) AS payment_provider,
        (SELECT p.status  FROM payments p WHERE p.order_id = o.id ORDER BY p.initiated_at DESC LIMIT 1) AS payment_status
      FROM orders o
      LEFT JOIN users u ON u.id = o.user_id
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

// ── GET /orders/mine — student's own orders ────────────────────
const getMyOrders = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT o.*,
        (SELECT json_agg(json_build_object('name', oi.name, 'quantity', oi.quantity, 'subtotal', oi.subtotal))
         FROM order_items oi WHERE oi.order_id = o.id) AS items,
        p.provider AS payment_provider, p.status AS payment_status
      FROM orders o
      LEFT JOIN payments p ON p.order_id = o.id
      WHERE o.user_id = $1
      ORDER BY o.created_at DESC LIMIT 20
    `, [req.user.id]);
    return success(res, rows);
  } catch (err) { next(err); }
};

// ── GET /orders/:id ────────────────────────────────────────────
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

// ── PATCH /orders/:id/status ───────────────────────────────────
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

// ── GET /orders/stats — admin dashboard stats ──────────────────
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

module.exports = { createOrder, getOrders, getMyOrders, getOrder, updateStatus, getStats };