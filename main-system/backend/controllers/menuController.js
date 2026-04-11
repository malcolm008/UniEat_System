const { query, withTransaction } = require('../../../shared/db/db');
const { success, error, notFound, created } = require('../../../shared/utils/response');

// Helper to get user's university ID from token
const getUserUniversity = async (userId) => {
    const { rows } = await query('SELECT university_id FROM users WHERE id = $1', [userId]);
    return rows[0]?.university_id;
};

// Get all menu items for admin (university-specific)
const getAllItems = async (req, res, next) => {
  try {
    const universityId = await getUserUniversity(req.user.id);
    if (!universityId) {
      return error(res, 'No university associated with your account', 400);
    }

    const { rows } = await query(
      `SELECT id, name, description, price, category, emoji, badge, calories, is_available, created_at, updated_at
       FROM menu_items
       WHERE university_id = $1
       ORDER BY
         CASE category
           WHEN 'breakfast' THEN 1
           WHEN 'lunch' THEN 2
           WHEN 'dinner' THEN 3
           WHEN 'snacks' THEN 4
           WHEN 'drinks' THEN 5
           ELSE 6
         END, name`,
      [universityId]
    );
    return success(res, rows);
  } catch (err) {
    console.error('Get all items error:', err);
    next(err);
  }
};

// Get single menu item
const getItem = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM menu_items WHERE id = $1', [req.params.id]);
    if (!rows[0]) return notFound(res, 'Menu item not found');
    return success(res, rows[0]);
  } catch (err) { next(err); }
};

// Create new menu item
const createItem = async (req, res, next) => {
  try {
    const { name, description, price, category, emoji, badge, calories, is_available } = req.body;
    const universityId = await getUserUniversity(req.user.id);

    if (!universityId) {
      return error(res, 'No university associated with your account', 400);
    }

    // Validate category
    const validCategories = ['breakfast', 'lunch', 'dinner', 'snacks', 'drinks', 'other'];
    const finalCategory = validCategories.includes(category) ? category : 'other';

    const { rows } = await query(
      `INSERT INTO menu_items (name, description, price, category, emoji, badge, calories, is_available, university_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [name, description, price, finalCategory, emoji || '🍽️', badge || '', calories || null, is_available !== false, universityId, req.user.id]
    );
    return created(res, rows[0], 'Menu item created');
  } catch (err) {
    console.error('Create item error:', err);
    next(err);
  }
};

// Update menu item
const updateItem = async (req, res, next) => {
  try {
    const { name, description, price, category, emoji, badge, calories, is_available } = req.body;
    const universityId = await getUserUniversity(req.user.id);

    if (!universityId) {
      return error(res, 'No university associated with your account', 400);
    }

    // Build dynamic update query
    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${idx++}`);
      values.push(description);
    }
    if (price !== undefined) {
      updates.push(`price = $${idx++}`);
      values.push(price);
    }
    if (category !== undefined) {
      const validCategories = ['breakfast', 'lunch', 'dinner', 'snacks', 'drinks', 'other'];
      const finalCategory = validCategories.includes(category) ? category : 'other';
      updates.push(`category = $${idx++}`);
      values.push(finalCategory);
    }
    if (emoji !== undefined) {
      updates.push(`emoji = $${idx++}`);
      values.push(emoji || '🍽️');
    }
    if (badge !== undefined) {
      updates.push(`badge = $${idx++}`);
      values.push(badge || '');
    }
    if (calories !== undefined) {
      updates.push(`calories = $${idx++}`);
      values.push(calories || null);
    }
    if (is_available !== undefined) {
      updates.push(`is_available = $${idx++}`);
      values.push(is_available);
    }

    if (updates.length === 0) {
      return error(res, 'No fields to update', 400);
    }

    updates.push(`updated_at = NOW()`);
    values.push(req.params.id);
    values.push(universityId);

    const queryText = `UPDATE menu_items SET ${updates.join(', ')} WHERE id = $${idx++} AND university_id = $${idx} RETURNING *`;

    const { rows } = await query(queryText, values);

    if (!rows[0]) return notFound(res, 'Menu item not found');
    return success(res, rows[0], 'Menu item updated');
  } catch (err) {
    console.error('Update item error:', err);
    next(err);
  }
};

// Delete menu item
const deleteItem = async (req, res, next) => {
  try {
    const universityId = await getUserUniversity(req.user.id);
    const { rows } = await query(
      'DELETE FROM menu_items WHERE id = $1 AND university_id = $2 RETURNING id',
      [req.params.id, universityId]
    );
    if (!rows[0]) return notFound(res, 'Menu item not found');
    return success(res, null, 'Menu item deleted');
  } catch (err) { next(err); }
};

// Toggle availability
const toggleAvailability = async (req, res, next) => {
  try {
    const universityId = await getUserUniversity(req.user.id);
    const { rows } = await query(
      `UPDATE menu_items
       SET is_available = NOT is_available, updated_at = NOW()
       WHERE id = $1 AND university_id = $2
       RETURNING id, is_available`,
      [req.params.id, universityId]
    );
    if (!rows[0]) return notFound(res, 'Menu item not found');
    return success(res, rows[0], 'Availability toggled');
  } catch (err) { next(err); }
};

// Get public menu (for students) - only available items from their university
const getMenu = async (req, res, next) => {
  try {
    let universityId = null;
    if (req.user) {
      universityId = await getUserUniversity(req.user.id);
    }

    if (!universityId) {
      return success(res, [], 'No menu available');
    }

    const { rows } = await query(
      `SELECT id, name, description, price, category, emoji, badge, calories, is_available
       FROM menu_items
       WHERE university_id = $1 AND is_available = true
       ORDER BY
         CASE category
           WHEN 'breakfast' THEN 1
           WHEN 'lunch' THEN 2
           WHEN 'dinner' THEN 3
           WHEN 'snacks' THEN 4
           WHEN 'drinks' THEN 5
           ELSE 6
         END, name`,
      [universityId]
    );
    return success(res, rows);
  } catch (err) { next(err); }
};

// Get daily menu (for students) - university specific
const getDailyMenu = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    let universityId = null;

    if (req.user) {
      universityId = await getUserUniversity(req.user.id);
    }

    if (!universityId) {
      return success(res, [], 'No daily menu available');
    }

    const { rows } = await query(
      `SELECT m.id, m.name, m.description, m.price, m.category, m.emoji, m.badge, m.calories, m.is_available
       FROM menu_items m
       INNER JOIN daily_menus d ON m.id = d.menu_item_id
       WHERE d.date = $1
         AND m.is_available = true
         AND m.university_id = $2
         AND d.university_id = $2
       ORDER BY
         CASE m.category
           WHEN 'breakfast' THEN 1
           WHEN 'lunch' THEN 2
           WHEN 'dinner' THEN 3
           WHEN 'snacks' THEN 4
           WHEN 'drinks' THEN 5
           ELSE 6
         END, m.name`,
      [today, universityId]
    );
    return success(res, rows, 'Daily menu retrieved');
  } catch (err) {
    console.error('Get daily menu error:', err);
    next(err);
  }
};

// Get daily menu IDs (for admin selection) - university specific
const getDailyMenuIds = async (req, res, next) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const universityId = await getUserUniversity(req.user.id);

    if (!universityId) {
      return success(res, [], 'No university found');
    }

    const { rows } = await query(
      'SELECT menu_item_id FROM daily_menus WHERE date = $1 AND university_id = $2',
      [today, universityId]
    );
    return success(res, rows.map(r => r.menu_item_id), 'Daily menu IDs retrieved');
  } catch (err) {
    console.error('Get daily menu IDs error:', err);
    next(err);
  }
};

// Set daily menu (admin) - university specific
const setDailyMenu = async (req, res, next) => {
  try {
    const { date, items } = req.body;
    const menuDate = date || new Date().toISOString().split('T')[0];
    const universityId = await getUserUniversity(req.user.id);

    if (!universityId) {
      return error(res, 'No university associated with your account', 400);
    }

    // Handle both formats: array of strings (IDs) or array of objects
    let menuItems = items;
    if (items && items.length > 0 && typeof items[0] === 'string') {
      menuItems = items.map(id => ({ menu_item_id: id, is_available: true }));
    }

    // Delete old daily entries for this date and university
    await query('DELETE FROM daily_menus WHERE date = $1 AND university_id = $2', [menuDate, universityId]);

    // Insert new ones
    for (const item of menuItems) {
      if (item.menu_item_id) {
        await query(`
          INSERT INTO daily_menus (id, date, menu_item_id, is_available, stock_count, created_by, university_id, created_at)
          VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6, NOW())
        `, [menuDate, item.menu_item_id, item.is_available !== false, item.stock_count || null, req.user.id, universityId]);
      }
    }

    return success(res, { date: menuDate, count: menuItems.length }, 'Daily menu updated');
  } catch (err) {
    console.error('Set daily menu error:', err);
    next(err);
  }
};

// Get categories (for dropdown)
const getCategoriesList = async (req, res, next) => {
  try {
    const categories = [
      { key: 'breakfast', label: 'Breakfast' },
      { key: 'lunch', label: 'Lunch' },
      { key: 'dinner', label: 'Dinner' },
      { key: 'snacks', label: 'Snacks' },
      { key: 'drinks', label: 'Drinks' },
      { key: 'other', label: 'Other' }
    ];
    return success(res, categories);
  } catch (err) { next(err); }
};

// Get daily summary (for reports)
const getDailySummary = async (req, res, next) => {
  try {
    const { date } = req.query;
    const targetDate = date || new Date().toISOString().split('T')[0];
    const universityId = await getUserUniversity(req.user.id);

    const { rows } = await query(
      `SELECT m.name, m.price, d.is_available, d.stock_count
       FROM daily_menus d
       JOIN menu_items m ON d.menu_item_id = m.id
       WHERE d.date = $1 AND d.university_id = $2`,
      [targetDate, universityId]
    );
    return success(res, rows);
  } catch (err) { next(err); }
};

module.exports = {
  getMenu,
  getAllItems,
  getItem,
  createItem,
  updateItem,
  deleteItem,
  toggleAvailability,
  getCategoriesList,
  setDailyMenu,
  getDailySummary,
  getDailyMenu,
  getDailyMenuIds
};