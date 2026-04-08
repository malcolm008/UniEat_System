require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

// Import from shared directory (adjust path as needed)
const { logger, setSystem } = require('../../shared/utils/logger');
const { success } = require('../../shared/utils/response');
const { query } = require('../../shared/db/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { authenticate, checkSubscription } = require('../../shared/middleware/auth');
const { authRouter, menuRouter, orderRouter, paymentRouter, userRouter, reportRouter } = require('./routes/index');

// Set system name for logging
setSystem('main-system');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors({
    origin: [
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:5500',
        'http://localhost:63342',      // JetBrains IDE
        'http://127.0.0.1:63342',      // JetBrains IDE alternative
        'http://localhost:5000',
        'http://127.0.0.1:5000'
    ],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {success: false, message: 'Too many requests, try again later'},
    standardHeader: true,
    legacyHeaders: false,
}));

app.use(express.json({limit: '2mb'}));

// Logging
if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev', {stream: {write: msg => logger.info(msg.trim())}}));
}

// Health check
app.get('/health', async (req, res) => {
    try {
        await query('SELECT 1');
        success(res, {
            status: 'ok',
            service: 'UniEat Main API',
            database: 'connected',
            timestamp: new Date().toISOString()
        });
    } catch (err) {
        success(res, {
            status: 'degraded',
            service: 'UniEat Main API',
            database: 'disconnected',
            timestamp: new Date().toISOString()
        });
    }
});

// Routes
app.use('/api/auth', authRouter);
app.use('/api/menu', authenticate, checkSubscription, menuRouter);
app.use('/api/orders', authenticate, checkSubscription, orderRouter);
app.use('/api/payments', authenticate, checkSubscription, paymentRouter);
app.use('/api/users', authenticate, checkSubscription, userRouter);
app.use('/api/reports', authenticate, checkSubscription, reportRouter);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
    logger.info(`   UniEat Main API running on http://localhost:${PORT}`);
    logger.info(`   Environment : ${process.env.NODE_ENV}`);
    logger.info(`   Database    : ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
    logger.info(`   Docs        : GET /health`);
});

module.exports = app;