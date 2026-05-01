const { query } = require('../../../shared/db/db');
const { success } = require('../../../shared/utils/response');

const getSalesReport = async (req, res, next) => {
    try {
        const { from, to, payment_method, category, university_id} = req.query;

        const fromDate = from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        const toDate = to || new Date().toISOString().split('T')[0];

        const universityFilter = university_id || req.user?.university_id;

        let baseWhere = `WHERE DATE(o.created_at) BETWEEN $1 AND $2`;

        let params = [fromDate, toDate];
        let paramCount = 2;

        if (universityFilter) {
            paramCount++;
            baseWhere += ` AND o.university_id = $${paramCount}`;
            params.push(universityFilter);
        }

        if (payment_method && payment_method !== 'all') {
            paramCount++;
            baseWhere += ` AND p.provider = $${paramCount}`;
            params.push(payment_method);
        }

        const summaryQuery = `
            SELECT
            COUNT(*) AS total_orders,
            COALESCE(SUM(total), 0) AS total_revenue,
            COALESCE(AVG(total), 0) AS avg_order_value,
            COUNT(*) FILTER (WHERE status = 'served') AS completed_orders,
            COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled_orders,
            COUNT(*) FILTER (WHERE status = 'pending_verification') AS pending_verification,
            COUNT(*) FILTER (WHERE status = 'paid') AS ready_for_pickup
            FROM orders o
            ${baseWhere}
        `;

        const dailyQuery = `
            SELECT
            DATE(o.created_at) AS date,
            COUNT(*) AS orders,
            SUM(o.total) AS revenue,
            COUNT(*) FILTER (WHERE o.status = 'served') AS served_count
            FROM orders o
            ${baseWhere}
            GROUP BY DATE(o.created_at)
            ORDER BY date
        `;

        const categoryQuery = `
            SELECT
            COALESCE(mi.category, 'Other') AS category,
            COUNT(DISTINCT oi.order_id) AS orders,
            SUM(oi.subtotal) AS revenue,
            SUM(oi.quantity) AS items_sold
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            LEFT JOIN menu_items mi ON mi.id = oi.menu_item_id
            WHERE DATE(o.created_at) BETWEEN $1 AND $2
            AND o.status NOT IN ('cancelled', 'refunded')
            ${universityFilter ? `AND o.university_id = $${paramCount}` : ''}
            GROUP BY mi.category
            ORDER BY revenue DESC
        `;

        const paymentQuery = `
            SELECT
            COALESCE(p.provider, 'Pending') AS provider,
            COUNT(*) AS transactions,
            SUM(p.amount) AS total,
            COUNT(*) FILTER (WHERE p.status = 'success') AS successful
            FROM payments p
            JOIN orders o ON o.id = p.order_id
            WHERE DATE(o.created_at) BETWEEN $1 AND $2
            AND p.status = 'success'
            ${universityFilter ? `AND o.university_id = $${paramCount}` : ''}
            GROUP BY p.provider
            ORDER BY total DESC
        `;

        const topItemsQuery = `
            SELECT
            oi.name,
            SUM(oi.quantity) AS qty,
            SUM(oi.subtotal) AS revenue,
            COUNT(DISTINCT oi.order_id) AS order_count
            FROM order_items oi
            JOIN orders o ON o.id = oi.order_id
            WHERE DATE(o.created_at) BETWEEN $1 AND $2
            AND o.status NOT IN ('cancelled', 'refunded')
            ${universityFilter ? `AND o.university_id = $${paramCount}` : ''}
            GROUP BY oi.name
            ORDER BY revenue DESC
            LIMIT 10
        `;

        const hourlyQuery = `
            SELECT
            EXTRACT(HOUR FROM o.created_at) AS hour,
            COUNT(*) AS orders,
            SUM(o.total) AS revenue
            FROM orders o
            WHERE DATE(o.created_at) BETWEEN $1 AND $2
            AND o.status NOT IN ('cancelled', 'refunded')
            ${universityFilter ? `AND o.university_id = $${paramCount}` : ''}
            GROUP BY EXTRACT(HOUR FROM o.created_at)
            ORDER BY hour
        `;

        const transactionStatsQuery = `
            SELECT
            COUNT(*) AS total_transactions,
            COUNT(*) FILTER (WHERE status = 'success') AS verified,
            COUNT(*) FILTER (WHERE status = 'pending_verification') AS pending_verification,
            COUNT(*) FILTER (WHERE status = 'failed') AS failed
            FROM transactions t
            JOIN orders o ON o.id = t.order_id
            WHERE DATE(t.created_at) BETWEEN $1 AND $2
            ${universityFilter ? `AND o.university_id = $${paramCount}` : ''}
        `;

        const [
            summaryResult,
            dailyResult,
            categoryResult,
            paymentResult,
            topItemsResult,
            hourlyResult,
            transactionStatsResult,
        ] = await Promise.all([
            query(summaryQuery, params),
            query(dailyQuery, params),
            query(categoryQuery, params),
            query(paymentQuery, params),
            query(topItemsQuery, params),
            query(hourlyQuery, params),
            query(transactionStatsQuery, params)
        ]);

        const summary = summaryResult.row[0] || {};
        const dailyRevenue = dailyResult.rows;
        const categoryBreakdown = categoryResult.rows;
        const paymentBreakdown = paymentResult.rows;
        const topItems = topItemsResult.rows;
        const hourlyDistribution = hourlyResult.rows.map(h => ({
            hour: `{String(h.hour).padStart(2, '0')}:00`,
            orders: parseInt(h.orders),
            revenue: parseInt(h.revenue)
        }));

        const peakHour = hourlyDistribution.reduce((max, h) => h.orders, max.orders ? h: max, { orders: 0, hour: '00:00' });

        let topPaymentMethod = 'N/A';
        let topPaymentPercentage = 0;
        if (paymentBreakdown.length > 0) {
            const top = paymentBreakdown.reduce((max, p) => (p.total > max.total) ? p : max, paymentBreakdown[0]);
            topPaymentMethod = top.provider;
            topPaymentPercentage = summary.total_revenue > 0 ? Math.round((top.total / summary.total_revenue) * 100) : 0
        }

        const categoryWithPercentage = categoryBreakdown.map(cat => ({
            name: cat.category,
            revenue: parseInt(cat.revenue),
            orders: parseInt(cat.orders),
            items_sold: parseInt(cat.items_sold),
            percentage: summary.total_revenue > 0 ? Math.round((cat.revenue / summary.total_revenue) * 100) : 0
        }));

        const paymentWithPercentage = paymentBreakdown.map(pay => ({
            method: pay.provider,
            amount: parseInt(pay.total),
            count: parseInt(pay.transactions),
            percentage: summary.total_revenue > 0 ? Math.round((pay.total / summary.total_revenue) * 100) : 0
        }));

        const transactionStats = transactionStatsResult.rows[0] || {};

        return success(res, {
            period: { from: fromDate, to: toDate },
            summary: {
                total_orders: parseInt(summary.total_orders || 0),
                total_revenue: parseInt(summary.total_revenue || 0),
                avg_order_value: parseInt(summary.avg_order_value || 0),
                completed_orders: parseInt(summary.completed_orders || 0),
                cancelled_orders: parseInt(summary.cancelled_orders || 0),
                pending_verification: parseInt(summary.pending_verification || 0),
                ready_for_pickup: parseInt(summary.ready_for_pickup || 0),
                top_payment_method: topPaymentMethod,
                top_payment_percentage: topPaymentPercentage,
                peak_hour: peakHour.hour,
                peak_hour_orders: peakHour.orders,
                total_transactions: parseInt(transactionStats.total_transactions || 0),
                verified_transactions: parseInt(transactionStats.verified || 0),
                verification_rate: transactionStats.total_transactions > 0 ? Math.round((transactionStats.verified / transactionStats.total_transactions) * 100) : 0
            },

            daily_revenue: dailyRevenue.map(d => ({
                date: d.date,
                revenue: parseInt(d.revenue),
                orders: parseInt(d.orders),
                served: parseInt(d.served_count || 0)
            })),

            category_breakdown: categoryWithPercentages,
            payment_breakdown: paymentWithPercentages,
            top_items: topItems.map(item => ({
                name: item.name,
                quantity: parseInt(item.qty),
                revenue: parseInt(item.revenue),
                order_count: parseInt(item.order_count)
            })),

            hourly_distribution: hourlyDistribution
        });
    } catch (err) {
        logger.error('Sales report error:', err);
        next(err);
    }
};

const getAuditLog = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, user_id, action, entity } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = 'WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (user_id) {
      whereClause += ` AND al.user_id = $${paramCount++}`;
      params.push(user_id);
    }
    if (action) {
      whereClause += ` AND al.action = $${paramCount++}`;
      params.push(action);
    }
    if (entity) {
      whereClause += ` AND al.entity = $${paramCount++}`;
      params.push(entity);
    }

    const { rows } = await query(`
      SELECT al.*, u.name AS user_name, u.reg_number, u.role
      FROM audit_log al
      LEFT JOIN users u ON u.id = al.user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT $${paramCount++} OFFSET $${paramCount}
    `, [...params, limit, offset]);

    const { rows: [countResult] } = await query(
      `SELECT COUNT(*) FROM audit_log al ${whereClause}`,
      params
    );

    return success(res, {
      items: rows,
      total: parseInt(countResult.count),
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(countResult.count / limit)
    });
  } catch (err) {
    logger.error('Audit log error:', err);
    next(err);
  }
};

module.exports = { getSalesReport, getAuditLog };