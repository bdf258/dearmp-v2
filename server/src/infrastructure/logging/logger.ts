import winston from 'winston';
import DailyRotateFile from 'winston-daily-rotate-file';
import path from 'path';

const LOGS_DIR = path.resolve(__dirname, '../../../logs');

const customFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
  winston.format.printf(({ timestamp, level, message }) => {
    return `${timestamp} [${level.toUpperCase()}] ${message}`;
  })
);

const fileTransport = new DailyRotateFile({
  dirname: LOGS_DIR,
  filename: 'dearmp-%DATE%.log',
  datePattern: 'YYYY-MM-DD',
  maxSize: '50m',
  maxFiles: '14d',
  format: customFormat,
});

const consoleTransport = new winston.transports.Console({
  format: winston.format.combine(
    winston.format.colorize(),
    winston.format.timestamp({ format: 'HH:mm:ss.SSS' }),
    winston.format.printf(({ timestamp, level, message }) => {
      return `${timestamp} ${level} ${message}`;
    })
  ),
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [fileTransport, consoleTransport],
});

/**
 * Redirects console.log, console.error, console.warn to the logger.
 * Call this once at application startup to capture all console output to log files.
 */
export function initializeLogging(processName: 'server' | 'worker'): void {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const originalInfo = console.info;
  const originalDebug = console.debug;

  const formatArgs = (...args: unknown[]): string => {
    return args
      .map((arg) => {
        if (typeof arg === 'string') return arg;
        if (arg instanceof Error) return `${arg.message}\n${arg.stack}`;
        try {
          return JSON.stringify(arg, null, 2);
        } catch {
          return String(arg);
        }
      })
      .join(' ');
  };

  console.log = (...args: unknown[]) => {
    const message = `[${processName}] ${formatArgs(...args)}`;
    logger.info(message);
  };

  console.error = (...args: unknown[]) => {
    const message = `[${processName}] ${formatArgs(...args)}`;
    logger.error(message);
  };

  console.warn = (...args: unknown[]) => {
    const message = `[${processName}] ${formatArgs(...args)}`;
    logger.warn(message);
  };

  console.info = (...args: unknown[]) => {
    const message = `[${processName}] ${formatArgs(...args)}`;
    logger.info(message);
  };

  console.debug = (...args: unknown[]) => {
    const message = `[${processName}] ${formatArgs(...args)}`;
    logger.debug(message);
  };

  logger.info(`[${processName}] Logging initialized - logs written to: ${LOGS_DIR}`);
}

export function getLogsDirectory(): string {
  return LOGS_DIR;
}
