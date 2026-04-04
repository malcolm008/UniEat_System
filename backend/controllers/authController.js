const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query } = require('../config/db');
const { success, error, unauthorized, created } = require('../utils/response');
const logger = require('../utils/logger');

const signTokens = (userId) => {
  const access = jwt.sign({ userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
  const refresh = jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET, {
    expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '30d',
  });
  return { access, refresh };
};

// POST /auth/login
const login = async (req, res, next) => {
  try {
    const { reg_number, password } = req.body;

    const { rows } = await query(
      'SELECT id, name, email, reg_number, password, role, is_active FROM users WHERE reg_number = $1',
      [reg_number?.trim()]
    );

    const user = rows[0];
    if (!user) return unauthorized(res, 'Invalid credentials');
    if (!user.is_active) return unauthorized(res, 'Account has been deactivated');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return unauthorized(res, 'Invalid credentials');

    const { access, refresh } = signTokens(user.id);

    logger.info(`User logged in: ${user.reg_number} (${user.role})`);

    return success(res, {
      access_token: access,
      refresh_token: refresh,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        reg_number: user.reg_number,
        role: user.role,
      },
    }, 'Login successful');
  } catch (err) {
    next(err);
  }
};

// POST /auth/refresh
const refresh = async (req, res, next) => {
  try {
    const { refresh_token } = req.body;
    if (!refresh_token) return error(res, 'Refresh token required');

    const decoded = jwt.verify(refresh_token, process.env.JWT_REFRESH_SECRET);
    const { rows } = await query(
      'SELECT id, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );
    if (!rows[0] || !rows[0].is_active) return unauthorized(res);

    const { access, refresh: newRefresh } = signTokens(rows[0].id);
    return success(res, { access_token: access, refresh_token: newRefresh }, 'Token refreshed');
  } catch (err) {
    if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
      return unauthorized(res, 'Invalid or expired refresh token');
    }
    next(err);
  }
};

// GET /auth/me
const me = async (req, res) => {
  const { id, name, email, reg_number, role } = req.user;
  return success(res, { id, name, email, reg_number, role });
};

// POST /auth/register  (admin only — creates staff/student accounts)
const register = async (req, res, next) => {
  try {
    const { name, email, reg_number, password, role = 'student' } = req.body;

    const hash = await bcrypt.hash(password, 12);
    const { rows } = await query(
      `INSERT INTO users (name, email, reg_number, password, role)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, email, reg_number, role, created_at`,
      [name, email || null, reg_number, hash, role]
    );

    logger.info(`New user registered: ${reg_number} (${role}) by ${req.user?.reg_number}`);
    return created(res, rows[0], 'User created');
  } catch (err) {
    next(err);
  }
};

module.exports = { login, refresh, me, register };