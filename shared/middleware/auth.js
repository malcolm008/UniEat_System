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
      'SELECT id, name, email, reg_number, role, is_active, university_id FROM users WHERE id = $1',
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

// ── Subscription check for university access ────────────────────
const checkSubscription = async (req, res, next) => {
  if (!req.user) return unauthorized(res);

  // Super admins bypass subscription check
  if (req.user.role === 'super_admin') {
    return next();
  }

  try {
    const { rows } = await query(
      `SELECT u.university_id, uni.subscription_status, uni.subscription_end
       FROM users u
       LEFT JOIN universities uni ON u.university_id = uni.id
       WHERE u.id = $1`,
      [req.user.id]
    );

    const userData = rows[0];

    if (!userData || !userData.university_id) {
      return res.status(403).json({
        success: false,
        message: 'No university affiliation found. Please contact your administrator.',
        code: 'NO_UNIVERSITY'
      });
    }

    if (userData.subscription_status !== 'active') {
        return res.status(403).json({
            success: false,
            message: `University subscription is ${userData.subscription_status}. Please contact your university administrator to renew.`,
            code: 'SUBSCRIPTION_INACTIVE',
            subscription_status: userData.subscription_status
        });
    }

    next();
  } catch (err) {
    console.error('Subscription check error:', err);
    return res.status(500).json({ success: false, message: 'Server error checking subscription' });
  }
};

// ── Optional auth (for guest-friendly endpoints) ────────────────
const optionalAuth = async (req, res, next) => {
  try {
    const header = req.headers.authorization;
    if (header && header.startsWith('Bearer ')) {
      const token = header.split(' ')[1];
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const { rows } = await query(
        'SELECT id, name, email, reg_number, role, university_id FROM users WHERE id = $1 AND is_active = true',
        [decoded.userId]
      );
      if (rows[0]) req.user = rows[0];
    }
  } catch (_) { /* guest — no user attached */ }
  next();
};

module.exports = {
  authenticate,
  requireAdmin,
  requireStaff,
  requireStudent,
  optionalAuth,
  checkSubscription
};