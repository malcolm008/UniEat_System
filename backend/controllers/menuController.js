const { query, withTransaction } = require('../config/db');
const { success, created, notFound, error, paginate } = require('../utils/response');

// ── GET /menu — public, returns today's available items ────────
const getMenu = async (req, res, next) => {
  try {
    const { category, search, date } = req.query;
    const menuDate = date || new Date().toISOString().split('T')[0];

    let sql = `
      SELECT
        mi.id, mi.name, mi.description, mi.price,
        mi.emoji, mi.badge, mi.calories, mi.is_available,
        c.name AS category_name, c.slug AS category_slug, c.id AS category_id,
        COALESCE(dm.is_available, mi.is_available) AS today_available,
        dm.stock_count
      FROM menu_items mi
      LEFT JOIN categories c ON c.id = mi.category_id
      LEFT JOIN daily_menus dm ON dm.menu_item_id = mi.id AND dm.date = $1
      WHERE mi.is_available = true
    `;
    const params = [menuDate];
    let idx = 2;

    if (category) { sql += ` AND c.slug = $${idx++}`; params.push(category); }
    if (search)   { sql += ` AND (mi.name ILIKE $${idx} OR mi.description ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    sql += ' ORDER BY c.sort_order, mi.sort_order, mi.name';

    const { rows } = await query(sql, params);

    // Group by category
    const grouped = rows.reduce((acc, item) => {
      const cat = item.category_slug || 'other';
      if (!acc[cat]) acc[cat] = { name: item.category_name, slug: cat, items: [] };
      acc[cat].items.push(item);
      return acc;
    }, {});

    return success(res, { date: menuDate, categories: grouped, total: rows.length });
  } catch (err) { next(err); }
};

// ── GET /menu/items — admin: all items with pagination ─────────
const getAllItems = async (req, res, next) => {
  try {
    const { page = 1, limit = 50, category, search, available } = req.query;
    const offset = (page - 1) * limit;

    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (category)  { where += ` AND c.slug = $${idx++}`;  params.push(category); }
    if (search)    { where += ` AND (mi.name ILIKE $${idx} OR mi.description ILIKE $${idx})`; params.push(`%${search}%`); idx++; }
    if (available !== undefined) { where += ` AND mi.is_available = $${idx++}`; params.push(available === 'true'); }

    const countSql = `SELECT COUNT(*) FROM menu_items mi LEFT JOIN categories c ON c.id = mi.category_id ${where}`;
    const itemsSql = `
      SELECT mi.*, c.name AS category_name, c.slug AS category_slug
      FROM menu_items mi
      LEFT JOIN categories c ON c.id = mi.category_id
      ${where}
      ORDER BY c.sort_order, mi.sort_order, mi.name
      LIMIT $${idx++} OFFSET $${idx}
    `;

    const [countResult, itemsResult] = await Promise.all([
      query(countSql, params),
      query(itemsSql, [...params, limit, offset]),
    ]);

    return paginate(res, itemsResult.rows, parseInt(countResult.rows[0].count), page, limit);
  } catch (err) { next(err); }
};

// ── GET /menu/items/:id ────────────────────────────────────────
const getItem = async (req, res, next) => {
  try {
    const { rows } = await query(`
      SELECT mi.*, c.name AS category_name, c.slug AS category_slug
      FROM menu_items mi LEFT JOIN categories c ON c.id = mi.category_id
      WHERE mi.id = $1
    `, [req.params.id]);
    if (!rows[0]) return notFound(res, 'Menu item not found');
    return success(res, rows[0]);
  } catch (err) { next(err); }
};

// ── POST /menu/items ───────────────────────────────────────────
const createItem = async (req, res, next) => {
  try {
    const { name, description, price, category_id, emoji, badge, calories, is_available, sort_order } = req.body;
    const { rows } = await query(`
      INSERT INTO menu_items (name, description, price, category_id, emoji, badge, calories, is_available, sort_order, created_by)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
      RETURNING *
    `, [name, description, price, category_id || null, emoji || '🍽️',
        badge || null, calories || null, is_available !== false, sort_order || 0, req.user.id]);
    return created(res, rows[0], 'Menu item created');
  } catch (err) { next(err); }
};

// ── PATCH /menu/items/:id ──────────────────────────────────────
const updateItem = async (req, res, next) => {
  try {
    const allowed = ['name','description','price','category_id','emoji','badge','calories','is_available','sort_order','image_url'];
    const updates = Object.entries(req.body).filter(([k]) => allowed.includes(k));
    if (!updates.length) return error(res, 'No valid fields to update');

    const sets = updates.map(([k], i) => `${k} = $${i + 2}`).join(', ');
    const vals = updates.map(([, v]) => v);

    const { rows } = await query(
      `UPDATE menu_items SET ${sets} WHERE id = $1 RETURNING *`,
      [req.params.id, ...vals]
    );
    if (!rows[0]) return notFound(res, 'Menu item not found');
    return success(res, rows[0], 'Menu item updated');
  } catch (err) { next(err); }
};

// ── DELETE /menu/items/:id ─────────────────────────────────────
const deleteItem = async (req, res, next) => {
  try {
    const { rows } = await query('DELETE FROM menu_items WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return notFound(res, 'Menu item not found');
    return success(res, { id: req.params.id }, 'Menu item deleted');
  } catch (err) { next(err); }
};

// ── PATCH /menu/items/:id/toggle ──────────────────────────────
const toggleAvailability = async (req, res, next) => {
  try {
    const { rows } = await query(
      'UPDATE menu_items SET is_available = NOT is_available WHERE id = $1 RETURNING id, name, is_available',
      [req.params.id]
    );
    if (!rows[0]) return notFound(res, 'Menu item not found');
    return success(res, rows[0], `Item ${rows[0].is_available ? 'enabled' : 'disabled'}`);
  } catch (err) { next(err); }
};

// ── GET /menu/categories ───────────────────────────────────────
const getCategories = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM categories WHERE is_active = true ORDER BY sort_order');
    return success(res, rows);
  } catch (err) { next(err); }
};

// ── POST /menu/daily — set today's menu ───────────────────────
const setDailyMenu = async (req, res, next) => {
  try {
    const { date, items } = req.body; // items: [{menu_item_id, is_available, stock_count}]
    const menuDate = date || new Date().toISOString().split('T')[0];

    await withTransaction(async (client) => {
      // Remove old daily entries for this date
      await client.query('DELETE FROM daily_menus WHERE date = $1', [menuDate]);
      // Insert new ones
      for (const item of items) {
        await client.query(`
          INSERT INTO daily_menus (date, menu_item_id, is_available, stock_count, created_by)
          VALUES ($1, $2, $3, $4, $5)
        `, [menuDate, item.menu_item_id, item.is_available !== false, item.stock_count || null, req.user.id]);
      }
    });

    return success(res, { date: menuDate, count: items.length }, 'Daily menu updated');
  } catch (err) { next(err); }
};

// ── GET /menu/daily-summary ───────────────────────────────────
const getDailySummary = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { rows } = await query(`
      SELECT
        COUNT(*) FILTER (WHERE mi.is_available) AS total_available,
        COUNT(*) FILTER (WHERE c.slug = 'breakfast') AS breakfast_count,
        COUNT(*) FILTER (WHERE c.slug = 'lunch') AS lunch_count,
        COUNT(*) FILTER (WHERE c.slug = 'dinner') AS dinner_count,
        COUNT(*) FILTER (WHERE c.slug = 'snacks') AS snacks_count,
        COUNT(*) FILTER (WHERE c.slug = 'drinks') AS drinks_count
      FROM menu_items mi
      LEFT JOIN categories c ON c.id = mi.category_id
      WHERE mi.is_available = true
    `);
    return success(res, { date: today, ...rows[0] });
  } catch (err) { next(err); }
};

module.exports = {
  getMenu, getAllItems, getItem, createItem, updateItem,
  deleteItem, toggleAvailability, getCategories, setDailyMenu, getDailySummary,
};