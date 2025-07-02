import winston from 'winston';
import path from 'path';

const logLevel = process.env.LOG_LEVEL || 'info';

const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.json(),
  winston.format.printf(({ timestamp, level, message, stack, service }) => {
    const serviceTag = service ? `[${service}]` : '';
    if (stack) {
      return `${timestamp} ${level.toUpperCase()} ${serviceTag}: ${message}\n${stack}`;
    }
    return `${timestamp} ${level.toUpperCase()} ${serviceTag}: ${message}`;
  })
);

const logger = winston.createLogger({
  level: logLevel,
  format: logFormat,
  defaultMeta: { service: 'auto-trading-system' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'error.log'),
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    new winston.transports.File({
      filename: path.join(process.cwd(), 'logs', 'combined.log'),
      maxsize: 5242880, // 5MB
      maxFiles: 5
    })
  ]
});

// Create logs directory if it doesn't exist
import fs from 'fs';
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

export default logger;