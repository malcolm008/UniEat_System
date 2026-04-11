const { query } = require('../../../shared/db/db');
const bcrypt = require('bcryptjs');
const { success, notFound, error, paginate, created } = require('../../../shared/utils/response');

// Helper to get user's university ID from token
const getUserUniversity = async (userId) => {
    const { rows } = await query('SELECT university_id FROM users WHERE id = $1', [userId]);
    return rows[0]?.university_id;
};

// Get users - filtered by university (only users from same university)
const getUsers = async (req, res, next) => {
  try {
    const { page = 1, limit = 30, role, search } = req.query;
    const offset = (page - 1) * limit;

    // Get the logged-in user's university
    const universityId = await getUserUniversity(req.user.id);
    if (!universityId) {
      return error(res, 'No university associated with your account', 400);
    }

    let where = 'WHERE university_id = $1';
    const params = [universityId];
    let idx = 2;

    if (role)   { where += ` AND role = $${idx++}`;  params.push(role); }
    if (search) { where += ` AND (name ILIKE $${idx} OR reg_number ILIKE $${idx} OR email ILIKE $${idx})`; params.push(`%${search}%`); idx++; }

    const [cnt, rows] = await Promise.all([
      query(`SELECT COUNT(*) FROM users ${where}`, params),
      query(`SELECT id, name, email, reg_number, role, is_active, display_name, created_at
             FROM users ${where}
             ORDER BY created_at DESC
             LIMIT $${idx++} OFFSET $${idx}`,
             [...params, limit, offset]),
    ]);
    return paginate(res, rows.rows, parseInt(cnt.rows[0].count), page, limit);
  } catch (err) { next(err); }
};

// Get single user - must be from same university
const getUser = async (req, res, next) => {
  try {
    const universityId = await getUserUniversity(req.user.id);
    if (!universityId) {
      return error(res, 'No university associated with your account', 400);
    }

    const { rows } = await query(
      'SELECT id, name, email, reg_number, role, is_active, display_name, created_at FROM users WHERE id = $1 AND university_id = $2',
      [req.params.id, universityId]
    );
    if (!rows[0]) return notFound(res, 'User not found');
    return success(res, rows[0]);
  } catch (err) { next(err); }
};

// Create user - automatically assigns to admin's university
const createUser = async (req, res, next) => {
  try {
    const { name, email, reg_number, password, role = 'staff' } = req.body;

    // Get the admin's university ID
    const universityId = await getUserUniversity(req.user.id);
    if (!universityId) {
      return error(res, 'No university associated with your account', 400);
    }

    // Check if user already exists in the same university
    const existing = await query(
      'SELECT id FROM users WHERE (reg_number = $1 OR email = $2) AND university_id = $3',
      [reg_number, email, universityId]
    );

    if (existing.rows.length > 0) {
      return error(res, 'User with this registration number or email already exists in your university', 400);
    }

    const hash = await bcrypt.hash(password, 12);

    const { rows } = await query(
      `INSERT INTO users (name, email, reg_number, password, role, is_active, display_name, university_id)
       VALUES ($1, $2, $3, $4, $5, true, $1, $6)
       RETURNING id, name, email, reg_number, role, display_name, university_id, created_at`,
      [name, email || null, reg_number, hash, role, universityId]
    );

    return created(res, rows[0], 'User created successfully');
  } catch (err) {
    console.error('Create user error:', err);
    next(err);
  }
};

// Update user - must be from same university
const updateUser = async (req, res, next) => {
  try {
    const { name, email, reg_number, role, is_active, display_name } = req.body;
    const userId = req.params.id;

    // Get admin's university
    const universityId = await getUserUniversity(req.user.id);
    if (!universityId) {
      return error(res, 'No university associated with your account', 400);
    }

    // First verify the user belongs to the same university
    const checkUser = await query(
      'SELECT id, role FROM users WHERE id = $1 AND university_id = $2',
      [userId, universityId]
    );
    if (!checkUser.rows[0]) return notFound(res, 'User not found in your university');

    console.log('Updating user:', { userId, name, email, reg_number, role, display_name });

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
    }
    if (email !== undefined) {
      updates.push(`email = $${idx++}`);
      values.push(email);
    }
    if (reg_number !== undefined) {
      updates.push(`reg_number = $${idx++}`);
      values.push(reg_number);
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

    const queryText = `UPDATE users SET ${updates.join(', ')} WHERE id = $${idx} AND university_id = $${idx + 1} RETURNING id, name, email, reg_number, role, is_active, display_name, created_at, updated_at`;
    values.push(universityId);

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

// Delete user - must be from same university and not admin
const deleteUser = async (req, res, next) => {
  try {
    const universityId = await getUserUniversity(req.user.id);
    if (!universityId) {
      return error(res, 'No university associated with your account', 400);
    }

    const checkUser = await query(
      'SELECT id, role FROM users WHERE id = $1 AND university_id = $2',
      [req.params.id, universityId]
    );
    if (!checkUser.rows[0]) return notFound(res, 'User not found');

    if (checkUser.rows[0].role === 'admin') {
      return error(res, 'Cannot delete admin users', 403);
    }

    const { rows } = await query(
      'DELETE FROM users WHERE id = $1 AND university_id = $2 RETURNING id',
      [req.params.id, universityId]
    );
    if (!rows[0]) return notFound(res, 'User not found');
    return success(res, {}, 'User deleted successfully');
  } catch (err) { next(err); }
};

// Reset password - must be from same university
const resetPassword = async (req, res, next) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) return error(res, 'Password must be at least 6 characters');

    const universityId = await getUserUniversity(req.user.id);
    if (!universityId) {
      return error(res, 'No university associated with your account', 400);
    }

    const hash = await bcrypt.hash(newPassword, 12);
    const { rows } = await query(
      'UPDATE users SET password = $1 WHERE id = $2 AND university_id = $3 RETURNING id',
      [hash, req.params.id, universityId]
    );
    if (!rows[0]) return notFound(res, 'User not found');
    return success(res, {}, 'Password reset successfully');
  } catch (err) { next(err); }
};

// Change password - user can change their own password (no university check needed since it's their own)
const changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.params.id;

    // Users can only change their own password
    if (userId !== req.user.id) {
      return error(res, 'You can only change your own password', 403);
    }

    console.log('Change password request for user:', userId);

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

// Toggle user status - must be from same university
const toggleUserStatus = async (req, res, next) => {
  try {
    const { is_active } = req.body;
    const universityId = await getUserUniversity(req.user.id);
    if (!universityId) {
      return error(res, 'No university associated with your account', 400);
    }

    const { rows } = await query(
      'UPDATE users SET is_active = $1 WHERE id = $2 AND university_id = $3 RETURNING id, name, is_active',
      [is_active, req.params.id, universityId]
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