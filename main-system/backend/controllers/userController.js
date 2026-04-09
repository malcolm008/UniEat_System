const { query } = require('../../../shared/db/db');
const bcrypt = require('bcryptjs');
const { success, notFound, error, paginate, created } = require('../../../shared/utils/response');

const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, role, search } = req.query;
    const offset = (page - 1) * limit;
    let where = 'WHERE 1=1';
    const params = [];
    let idx = 1;

    if (role)   { where += ` AND role = $${idx++}`;  params.push(role); }
    if (search) { where += ` AND (name ILIKE $${idx} OR reg_number ILIKE $${idx} OR email ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    const [cnt, rows] = await Promise.all([
      query(`SELECT COUNT(*) FROM users ${where}`, params),
      query(`SELECT id, name, email, reg_number, role, is_active, created_at FROM users ${where} ORDER BY created_at DESC LIMIT $${idx++} OFFSET $${idx}`, [...params, limit, offset]),
    ]);
    return paginate(res, rows.rows, parseInt(cnt.rows[0].count), page, limit);
  } catch (err) { next(err); }
};

const getUser = async (req, res, next) => {
  try {
    const { rows } = await query('SELECT id, name, email, reg_number, role, is_active, created_at FROM users WHERE id = $1', [req.params.id]);
    if (!rows[0]) return notFound(res, 'User not found');
    return success(res, rows[0]);
  } catch (err) { next(err); }
};

const createUser = async (req, res, next) => {
  try {
    const { name, email, reg_number, password, role = 'staff' } = req.body;

    const existing = await query(
      'SELECT id FROM users WHERE reg_number = $1 OR email = $2',
      [reg_number, email]
    );

    if (existing.rows.length > 0) {
      return error(res, 'User with this registration number or email already exists', 400);
    }

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `INSERT INTO users (name, email, reg_number, password, role, is_active)
       VALUES ($1, $2, $3, $4, $5, true)
       RETURNING id, name, email, reg_number, role, created_at`,
      [name, email || null, reg_number, hash, role]
    );

    return created(res, rows[0], 'User created successfully');
  } catch (err) { next(err); }
};

const updateUser = async (req, res, next) => {
  try {
    const { name, email, role, is_active, display_name } = req.body;
    const userId = req.params.id;

    console.log('Update user request:', { userId, display_name, name, email, role, is_active });

    // Build dynamic update query
    const updates = [];
    const values = [];
    let idx = 1;

    if (name !== undefined) {
      updates.push(`name = $${idx++}`);
      values.push(name);
    }
    if (display_name !== undefined) {
      updates.push(`display_name = $${idx++}`);
      values.push(display_name);
      console.log('Updating display_name to:', display_name);
    }
    if (email !== undefined) {
      updates.push(`email = $${idx++}`);
      values.push(email);
    }
    if (role !== undefined) {
      updates.push(`role = $${idx++}`);
      values.push(role);
    }
    if (is_active !== undefined) {
      updates.push(`is_active = $${idx++}`);
      values.push(is_active);
    }

    if (updates.length === 0) {
      return error(res, 'No fields to update', 400);
    }

    updates.push(`updated_at = NOW()`);
    values.push(userId);

    const queryText = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} RETURNING id, name, email, reg_number, role, is_active, display_name, created_at, updated_at`;

    console.log('Update query:', queryText);
    console.log('Update values:', values);

    const { rows } = await query(queryText, values);

    if (!rows[0]) return notFound(res, 'User not found');

    console.log('Update result:', rows[0]);

    return success(res, rows[0], 'User updated successfully');
  } catch (err) {
    console.error('Update user error:', err);
    next(err);
  }
};

const deleteUser = async (req, res, next) => {
  try {
    const checkUser = await query('SELECT id, role FROM users WHERE id = $1', [req.params.id]);
    if (!checkUser.rows[0]) return notFound(res, 'User not found');

    if (checkUser.rows[0].role === 'admin') {
      return error(res, 'Cannot delete admin users', 403);
    }

    const { rows } = await query('DELETE FROM users WHERE id = $1 RETURNING id', [req.params.id]);
    if (!rows[0]) return notFound(res, 'User not found');
    return success(res, {}, 'User deleted successfully');
  } catch (err) { next(err); }
};

const resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return error(res, 'Password must be at least 6 characters');
    const hash = await bcrypt.hash(newPassword, 12);
    const { rows } = await query('UPDATE users SET password = $1 WHERE id = $2 RETURNING id', [hash, req.params.id]);
    if (!rows[0]) return notFound(res, 'User not found');
    return success(res, {}, 'Password reset successfully');
  } catch (err) { next(err); }
};

const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.params.id;

    console.log('Change password request for user:', userId);
    console.log('Current password provided:', !!currentPassword);
    console.log('New password length:', newPassword?.length);

    if (!currentPassword || !newPassword) {
      return error(res, 'Current password and new password are required', 400);
    }

    if (newPassword.length < 6) {
      return error(res, 'New password must be at least 6 characters', 400);
    }

    // Get current user with password
    const { rows } = await query('SELECT password FROM users WHERE id = $1', [userId]);
    if (!rows[0]) return notFound(res, 'User not found');

    // Verify current password
    const isValid = await bcrypt.compare(currentPassword, rows[0].password);
    if (!isValid) {
      return error(res, 'Current password is incorrect', 401);
    }

    // Hash new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update password
    await query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, userId]);

    return success(res, {}, 'Password changed successfully');
  } catch (err) {
    console.error('Change password error:', err);
    next(err);
  }
};

const toggleUserStatus = async (req, res, next) => {
  try {
    const { is_active } = req.body;
    const { rows } = await query(
      'UPDATE users SET is_active = $1 WHERE id = $2 RETURNING id, name, is_active',
      [is_active, req.params.id]
    );
    if (!rows[0]) return notFound(res, 'User not found');
    return success(res, rows[0], `User ${is_active ? 'activated' : 'deactivated'} successfully`);
  } catch (err) { next(err); }
};

module.exports = {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  changePassword,
  toggleUserStatus
};