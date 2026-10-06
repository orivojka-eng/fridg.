import pino from 'pino';
import { config } from '../config.js';

// Never log request bodies: they can contain dietary/health data.
export const logger = pino({
  level: config.LOG_LEVEL,
  redact: {
    paths: ['req.headers.authorization', 'req.headers.cookie', 'password', '*.password', 'token', '*.token'],
    censor: '[redacted]',
  },
});
