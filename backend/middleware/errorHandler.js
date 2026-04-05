const logger = require('../utils/logger');
const { query } = require('../db/db');

// ── Global error handler ───────────────────────────────────────
const errorHandler = (err, req, res, next) => {
  logger.error(err.message, {
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  if (err.code === '23505') {
    return res.status(409).json({ success: false, message: 'Record already exists', field: err.detail });
  }
  if (err.code === '23503') {
    return res.status(400).json({ success: false, message: 'Referenced record does not exist' });
  }
  if (err.code === '23514') {
    return res.status(400).json({ success: false, message: 'Constraint violation: ' + err.detail });
  }

  const statusCode = err.statusCode || 500;
  res.status(statusCode).json({
    success: false,
    message: process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal server error'
      : err.message || 'Internal server error',
  });
};

// ── 404 handler ────────────────────────────────────────────────
const notFoundHandler = (req, res) => {
  res.status(404).json({ success: false, message: `Route ${req.method} ${req.path} not found` });
};

// ── Audit logger middleware ────────────────────────────────────
const audit = (action, entity) => async (req, res, next) => {
  res.on('finish', async () => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        await query(
          `INSERT INTO audit_log (user_id, action, entity, entity_id, meta, ip_address)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [
            req.user?.id || null,
            action,
            entity,
            req.params?.id || res.locals?.entityId || null,
            JSON.stringify({ method: req.method, body: req.body }),
            req.ip,
          ]
        );
      } catch (_) { /* non-critical */ }
    }
  });
  next();
};

module.exports = { errorHandler, notFoundHandler, audit };