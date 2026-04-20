// ── AUTH ROUTES ────────────────────────────────────────────────
const authRouter = require('express').Router();
const { login, refresh, me, register } = require('../controllers/authController');
const { authenticate, requireAdmin } = require('../../../shared/middleware/auth');
const { body, validationResult } = require('express-validator');
const { query } = require('../../../shared/db/db');
const { success, error, notFound } = require('../../../shared/utils/response');

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(422).json({ success: false, errors: errors.array() });
  next();
};

authRouter.post('/login',
  body('reg_number').notEmpty().trim(),
  body('password').isLength({ min: 6 }),
  validate, login
);
authRouter.post('/refresh', body('refresh_token').notEmpty(), validate, refresh);
authRouter.get('/me', authenticate, me);
authRouter.post('/register', authenticate, requireAdmin,
  body('name').notEmpty().trim(),
  body('reg_number').notEmpty().trim(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['student','staff','admin']),
  validate, register
);


// ── MENU ROUTES ────────────────────────────────────────────────
const menuRouter = require('express').Router();
const {
  getMenu, getAllItems, getItem, createItem, updateItem,
  deleteItem, toggleAvailability, getCategoriesList, setDailyMenu, getDailySummary,
  getDailyMenu, getDailyMenuIds
} = require('../controllers/menuController');
const { authenticate: auth, requireAdmin: admin, optionalAuth } = require('../../../shared/middleware/auth');

menuRouter.get('/',          optionalAuth, getMenu);
menuRouter.get('/categories', getCategoriesList);
menuRouter.get('/daily-summary', getDailySummary);
menuRouter.get('/daily',     optionalAuth, getDailyMenu);
menuRouter.get('/daily/ids', auth, admin, getDailyMenuIds);
menuRouter.get('/items',     auth, admin, getAllItems);
menuRouter.get('/items/:id', getItem);
menuRouter.post('/items',    auth, admin, body('name').notEmpty(), body('price').isInt({ min: 1 }), validate, createItem);
menuRouter.patch('/items/:id',         auth, admin, updateItem);
menuRouter.delete('/items/:id',        auth, admin, deleteItem);
menuRouter.patch('/items/:id/toggle',  auth, admin, toggleAvailability);
menuRouter.post('/daily',              auth, admin, setDailyMenu);


// ── ORDER ROUTES ───────────────────────────────────────────────
const orderRouter = require('express').Router();
const { createOrder, getOrders, getMyOrders, getOrder, updateStatus, getStats } = require('../controllers/orderController');
const authMw = require('../../../shared/middleware/auth');

orderRouter.post('/',          authMw.optionalAuth, createOrder);
orderRouter.get('/',           authMw.authenticate, authMw.requireStaff, getOrders);
orderRouter.get('/stats',      authMw.authenticate, authMw.requireAdmin, getStats);
orderRouter.get('/mine',       authMw.authenticate, getMyOrders);
orderRouter.get('/:id',        authMw.authenticate, authMw.requireStaff, getOrder);
orderRouter.patch('/:id/status', authMw.authenticate, authMw.requireStaff,
  body('status').isIn(['pending','paid','preparing','ready','served','cancelled']), validate, updateStatus
);


// ── PAYMENT ROUTES ─────────────────────────────────────────────
const paymentRouter = require('express').Router();
const {
    initiatePayment,
    confirmPayment,
    verifyQR,
    redeemQR,
    getQR,
    getVendorPaymentMethods,
    upsertPaymentMethod,
    deletePaymentMethod,
    togglePaymentMethodStatus,
    getActivePaymentMethod,
    getServiceFee,
    updateServiceFee,
    getActivePaymentMethodByUniversity,
    getAllPaymentMethodsByUniversity,
    confirmManualPayment,
    verifyPayment,
    getVendorTransactions,
    getPaymentStatus
} = require('../controllers/paymentController');
const pAuth = require('../../../shared/middleware/auth');

// Existing routes
paymentRouter.post('/initiate', pAuth.optionalAuth, initiatePayment);
paymentRouter.post('/confirm', confirmPayment);
paymentRouter.post('/verify-qr', pAuth.authenticate, pAuth.requireStaff, verifyQR);
paymentRouter.post('/redeem-qr', pAuth.authenticate, pAuth.requireStaff, redeemQR);
paymentRouter.get('/:orderId/qr', pAuth.optionalAuth, getQR);

// Payment management routes
paymentRouter.get('/vendor/methods', pAuth.authenticate, getVendorPaymentMethods);
paymentRouter.post('/vendor/methods', pAuth.authenticate, upsertPaymentMethod);
paymentRouter.put('/vendor/methods/:id', pAuth.authenticate, upsertPaymentMethod);
paymentRouter.delete('/vendor/methods/:id', pAuth.authenticate, deletePaymentMethod);
paymentRouter.patch('/vendor/methods/:id/toggle', pAuth.authenticate, togglePaymentMethodStatus);
paymentRouter.get('/vendor/methods/active', pAuth.authenticate, getActivePaymentMethod);
paymentRouter.get('/vendor/methods/by-university', pAuth.authenticate, getActivePaymentMethodByUniversity);
paymentRouter.get('/vendor/methods/by-university/all', pAuth.authenticate, getAllPaymentMethodsByUniversity);
paymentRouter.get('/settings/service-fee', pAuth.authenticate, getServiceFee);
paymentRouter.put('/settings/service-fee', pAuth.authenticate, updateServiceFee);

// Transaction routes
paymentRouter.get('/vendor/transactions', pAuth.authenticate, getVendorTransactions);
paymentRouter.get('/status/:orderId', pAuth.authenticate, getPaymentStatus);

// Manual payment flows
paymentRouter.post('/confirm-manual', pAuth.authenticate, confirmManualPayment);
paymentRouter.post('/verify-payment', pAuth.authenticate, verifyPayment);

// NOTE: Do NOT put module.exports here - it will be exported at the end


// ── USER ROUTES (Complete CRUD for staff management) ───────────
const userRouter = require('express').Router();
const {
  getUsers,
  getUser,
  createUser,
  updateUser,
  deleteUser,
  resetPassword,
  toggleUserStatus,
  changePassword
} = require('../controllers/userController');
const uAuth = require('../../../shared/middleware/auth');

userRouter.put('/profile', uAuth.authenticate, async (req, res, next) => {
  try {
    const { display_name } = req.body;
    const userId = req.user.id;

    console.log('Profile update request for user:', userId);
    console.log('New display_name:', display_name);

    if (!display_name || display_name.trim() === '') {
      return error(res, 'Display name cannot be empty', 400);
    }

    const { rows } = await query(
      `UPDATE users SET display_name = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, reg_number, role, is_active, display_name, created_at, updated_at`,
      [display_name, userId]
    );

    if (!rows[0]) return notFound(res, 'User not found');

    console.log('Profile updated successfully:', rows[0]);

    return success(res, rows[0], 'Profile updated successfully');
  } catch (err) {
    console.error('Profile update error:', err);
    next(err);
  }
});

// User management routes (admin only)
userRouter.get('/',          uAuth.authenticate, uAuth.requireAdmin, getUsers);
userRouter.get('/:id',       uAuth.authenticate, uAuth.requireAdmin, getUser);
userRouter.post('/',         uAuth.authenticate, uAuth.requireAdmin,
  body('name').notEmpty().trim(),
  body('reg_number').notEmpty().trim(),
  body('password').isLength({ min: 6 }),
  body('role').isIn(['student','staff','admin']),
  validate, createUser
);
userRouter.put('/:id',       uAuth.authenticate, uAuth.requireAdmin, updateUser);
userRouter.delete('/:id',    uAuth.authenticate, uAuth.requireAdmin, deleteUser);
userRouter.post('/:id/reset-password', uAuth.authenticate, uAuth.requireAdmin,
  body('newPassword').isLength({ min: 6 }), validate, resetPassword
);
userRouter.patch('/:id/toggle-status', uAuth.authenticate, uAuth.requireAdmin,
  body('is_active').isBoolean(), validate, toggleUserStatus
);
userRouter.post('/:id/change-password', uAuth.authenticate,
  body('currentPassword').notEmpty(),
  body('newPassword').isLength({ min: 6 }),
  validate, changePassword
);


// ── REPORT ROUTES ──────────────────────────────────────────────
const reportRouter = require('express').Router();
const { getSalesReport, getAuditLog } = require('../controllers/reportController');
const rAuth = require('../../../shared/middleware/auth');

reportRouter.get('/sales', rAuth.authenticate, rAuth.requireAdmin, getSalesReport);
reportRouter.get('/audit', rAuth.authenticate, rAuth.requireAdmin, getAuditLog);


// ── FINAL EXPORTS ──────────────────────────────────────────────
module.exports = { authRouter, menuRouter, orderRouter, paymentRouter, userRouter, reportRouter };