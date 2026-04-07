const { createLogger, format, transports } = require('winston');
const path = require('path');

// Simple wrapper to add system context
let currentSystem = 'unieat';

const setSystem = (systemName) => {
    currentSystem = systemName;
};

const logger = createLogger({
    level: process.env.LOG_LEVEL || 'info',
    format: format.combine(
        format.timestamp({format: 'YYYY-MM-DD HH:mm:ss'}),
        format.errors({ stack: true }),
        format.json()
    ),
    transports: [
        new transports.Console({
            format: format.combine(
                format.colorize(),
                format.printf(({ timestamp, level, message, ...meta }) => {
                    const systemTag = currentSystem !== 'unieat' ? `[${currentSystem}]` : '';
                    const extras = Object.keys(meta).length ? ' ' + JSON.stringify(meta) : '';
                    return `${timestamp} [${level}]${systemTag}: ${message}${extras}`;
                })
            ),
        }),
    ],
});

module.exports = { logger, setSystem };