import winston from 'winston';

const { combine, timestamp, printf, colorize } = winston.format;

const istTimestamp = timestamp({
  format: () =>
    new Intl.DateTimeFormat('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
      timeZone: 'Asia/Kolkata',
    }).format(new Date()),
});

const consoleFormat = printf(({ level, message, timestamp, ...meta }) => {
  const metaStr = Object.keys(meta).length
    ? '  →  ' + Object.entries(meta).map(([k, v]) => `${k}=${v}`).join(' ')
    : '';
  return `[${timestamp} IST]  ${level.padEnd(17)}  ${message}${metaStr}`;
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: combine(istTimestamp, winston.format.json()),
  transports: [
    new winston.transports.Console({
      format: combine(istTimestamp, colorize(), consoleFormat),
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
    }),
  ],
});
