const jwt = require('jsonwebtoken');
const { query } = require('../db/db');
const { unauthorized, forbidden } = require('../utils/response');

// ── Verify JWT ─────────────────────────────────────────────────
const authenticate = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
      return unauthorized(res, 'Access token required');
    }

    const token = header.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const { rows } = await query(
      'SELECT id, name, email, reg_number, role, is_active FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (!rows[0]) return unauthorized(res, 'User not found');
    if (!rows[0].is_active) return unauthorized(res, 'Account deactivated');

    req.user = rows[0];
    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') return unauthorized(res, 'Token expired');
    if (err.name === 'JsonWebTokenError')  return unauthorized(res, 'Invalid token');
    next(err);
  }
};

// ── Role guards ─────────────────────────────────────────────────
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) return unauthorized(res);
  if (!roles.includes(req.user.role)) {
    return forbidden(res, `Access restricted to: ${roles.join(', ')}`);
  }
  next();
};

const requireAdmin   = requireRole('admin');
const requireStaff   = requireRole('admin', 'staff');
const requireStudent = requireRole('admin', 'staff', 'student');

// ── Optional auth (for guest-friendly endpoints) ────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await query(
        'SELECT id, name, email, reg_number, role FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      if (rows[0]) req.user = rows[0];
    }
  } catch (_) { /* guest — no user attached */ }
  next();
};

module.exports = { authenticate, requireAdmin, requireStaff, requireStudent, optionalAuth };