// ── AUTH ROUTES ────────────────────────────────────────────────
const authRouter = require('express').Router();
const { login, refresh, me, register } = require('../controllers/authController');
const { authenticate, requireAdmin } = require('../../../shared/middleware/auth');
const { body, validationResult } = require('express-validator');

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
  deleteItem, toggleAvailability, getCategories, setDailyMenu, getDailySummary,
} = require('../controllers/menuController');
const { authenticate: auth, requireAdmin: admin, requireStaff: staff, optionalAuth } = require('../middleware/auth');

menuRouter.get('/',          optionalAuth, getMenu);
menuRouter.get('/categories', getCategories);
menuRouter.get('/daily-summary', getDailySummary);
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
const authMw = require('../middleware/auth');

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
const { initiatePayment, confirmPayment, verifyQR, redeemQR, getQR } = require('../controllers/paymentController');
const pAuth = require('../middleware/auth');

paymentRouter.post('/initiate',  pAuth.optionalAuth, initiatePayment);
paymentRouter.post('/confirm',   confirmPayment);          // called by webhook or test
paymentRouter.post('/verify-qr', pAuth.authenticate, pAuth.requireStaff, verifyQR);
paymentRouter.post('/redeem-qr', pAuth.authenticate, pAuth.requireStaff, redeemQR);
paymentRouter.get('/:orderId/qr',pAuth.optionalAuth, getQR);


// ── USER ROUTES ────────────────────────────────────────────────
const userRouter = require('express').Router();
const { getUsers, getUser, updateUser, resetPassword } = require('../controllers/userController');
const uAuth = require('../middleware/auth');

userRouter.get('/',          uAuth.authenticate, uAuth.requireAdmin, getUsers);
userRouter.get('/:id',       uAuth.authenticate, uAuth.requireAdmin, getUser);
userRouter.patch('/:id',     uAuth.authenticate, uAuth.requireAdmin, updateUser);
userRouter.post('/:id/reset-password', uAuth.authenticate, uAuth.requireAdmin,
  body('password').isLength({ min: 6 }), validate, resetPassword
);


// ── REPORT ROUTES ──────────────────────────────────────────────
const reportRouter = require('express').Router();
const { getSalesReport, getAuditLog } = require('../controllers/reportController');
const rAuth = require('../middleware/auth');

reportRouter.get('/sales', rAuth.authenticate, rAuth.requireAdmin, getSalesReport);
reportRouter.get('/audit', rAuth.authenticate, rAuth.requireAdmin, getAuditLog);


module.exports = { authRouter, menuRouter, orderRouter, paymentRouter, userRouter, reportRouter };