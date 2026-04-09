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
    const { name, email, role, is_active } = req.body;
    const { rows } = await query(
      `UPDATE users SET name = COALESCE($1,name), email = COALESCE($2,email), role = COALESCE($3,role), is_active = COALESCE($4,is_active)
       WHERE id = $5 RETURNING id, name, email, reg_number, role, is_active`,
      [name || null, email || null, role || null, is_active ?? null, req.params.id]
    );
    if (!rows[0]) return notFound(res, 'User not found');
    return success(res, rows[0], 'User updated');
  } catch (err) { next(err); }
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
  toggleUserStatus
};