const { query } = require('../config/db');
const { success } = require('../utils/response');

const getSalesReport = async (req, res, next) => {
  try {
    const { from, to } = req.query;
    const fromDate = from || new Date(Date.now() - 30*24*60*60*1000).toISOString().split('T')[0];
    const toDate   = to   || new Date().toISOString().split('T')[0];

    const [daily, byCategory, byProvider, topItems, summary] = await Promise.all([
      query(`
        SELECT DATE(o.created_at) AS date, COUNT(*) AS orders, SUM(o.total) AS revenue
        FROM orders o WHERE DATE(o.created_at) BETWEEN $1 AND $2
          AND o.status NOT IN ('cancelled','refunded')
        GROUP BY DATE(o.created_at) ORDER BY date
      `, [fromDate, toDate]),

      query(`
        SELECT c.name AS category, COUNT(*) AS orders, SUM(oi.subtotal) AS revenue
        FROM order_items oi
        JOIN orders o ON o.id = oi.order_id
        JOIN menu_items mi ON mi.id = oi.menu_item_id
        JOIN categories c ON c.id = mi.category_id
        WHERE DATE(o.created_at) BETWEEN $1 AND $2 AND o.status NOT IN ('cancelled','refunded')
        GROUP BY c.name, c.sort_order ORDER BY c.sort_order
      `, [fromDate, toDate]),

      query(`
        SELECT p.provider, COUNT(*) AS transactions, SUM(p.amount) AS total
        FROM payments p JOIN orders o ON o.id = p.order_id
        WHERE DATE(o.created_at) BETWEEN $1 AND $2 AND p.status = 'success'
        GROUP BY p.provider
      `, [fromDate, toDate]),

      query(`
        SELECT oi.name, SUM(oi.quantity) AS qty, SUM(oi.subtotal) AS revenue
        FROM order_items oi JOIN orders o ON o.id = oi.order_id
        WHERE DATE(o.created_at) BETWEEN $1 AND $2 AND o.status NOT IN ('cancelled','refunded')
        GROUP BY oi.name ORDER BY qty DESC LIMIT 10
      `, [fromDate, toDate]),

      query(`
        SELECT COUNT(*) AS total_orders,
               COALESCE(SUM(total),0) AS total_revenue,
               COALESCE(AVG(total),0) AS avg_order_value,
               COUNT(*) FILTER (WHERE status='served') AS completed,
               COUNT(*) FILTER (WHERE status='cancelled') AS cancelled
        FROM orders WHERE DATE(created_at) BETWEEN $1 AND $2
      `, [fromDate, toDate]),
    ]);

    return success(res, {
      period: { from: fromDate, to: toDate },
      summary: summary.rows[0],
      daily_revenue: daily.rows,
      by_category: byCategory.rows,
      by_payment_provider: byProvider.rows,
      top_items: topItems.rows,
    });
  } catch (err) { next(err); }
};

const getAuditLog = async (req, res, next) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;
    const { rows } = await query(`
      SELECT al.*, u.name AS user_name, u.reg_number
      FROM audit_log al LEFT JOIN users u ON u.id = al.user_id
      ORDER BY al.created_at DESC LIMIT $1 OFFSET $2
    `, [limit, offset]);
    return success(res, rows);
  } catch (err) { next(err); }
};

module.exports = { getSalesReport, getAuditLog };