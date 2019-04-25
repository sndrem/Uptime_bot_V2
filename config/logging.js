const { createLogger, format, transports } = require('winston');
const { combine, timestamp, label, prettyPrint } = format;
const level = process.env.LOG_LEVEL || 'debug';
const logger = createLogger({
    level: level,
    format: combine(
        label({ label: 'Uptime-bot' }),
        timestamp(),
        prettyPrint()
    ),
    transports: [
        //
        // - Write to all logs with level `info` and below to `combined.log` 
        // - Write all logs error (and below) to `error.log`.
        //
        new transports.File({ filename: 'error.log', level: 'error' }),
        new transports.File({ filename: 'combined.log' })
    ],
    exceptionHandlers: [
        new transports.File({ filename: 'exceptions.log' })
    ]
});

//
// If we're not in production then log to the `console` with the format:
// `${info.level}: ${info.message} JSON.stringify({ ...rest }) `
// 
if (process.env.NODE_ENV !== 'production') {
    logger.add(new transports.Console({
        format: format.simple()
    }));
}

module.exports = logger;