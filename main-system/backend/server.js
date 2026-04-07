require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const logger = require('./utils/logger');
const {errorHandler, notFoundHandler} = require('./middleware/errorHandler');
const {authRouter, menuRouter, orderRouter, paymentRouter, userRouter, reportRouter} = require('./routes/index');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors({
    origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
    credentials: true,
}));
app.use(rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
    max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
    message: {success: false, message: 'Too many requests, try again later'},
    standardHeader: true,
    legacyHeaders: false,
}));

app.use(express.json({limit: '2mb'}));
app.use(express.json({extended: true}));

if (process.env.NODE_ENV !== 'test') {
    app.use(morgan('dev', {stream: {write: msg => logger.info(msg.trim())}}));
}

app.get('/health', (req, res) => {
    res.json({
        status: 'ok',
        service: 'UniEat API',
        version: '1.0.0',
        env: process.env.NODE_ENV,
        timestamp: new Date().toISOString(),
    });
});

app.use('/api/auth', authRouter);
app.use('/api/menu', menuRouter);
app.use('/api/orders', orderRouter);
app.use('/api/payments', paymentRouter);
app.use('/api/users', userRouter);
app.use('/api/reports', reportRouter);

app.use(notFoundHandler);
app.use(errorHandler);

app.listen(PORT, () => {
      logger.info(`   UniEat API running on http://localhost:${PORT}`);
      logger.info(`   Environment : ${process.env.NODE_ENV}`);
      logger.info(`   Database    : ${process.env.DB_NAME}@${process.env.DB_HOST}:${process.env.DB_PORT}`);
      logger.info(`   Docs        : GET /health`);
});

module.exports = app;