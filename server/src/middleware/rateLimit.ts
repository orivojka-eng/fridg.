import rateLimit, { ipKeyGenerator } from 'express-rate-limit';
import type { Request } from 'express';
import { AppError } from '../lib/errors.js';

// Signed-in users are limited per account; anonymous traffic per IP (IPv6 grouped by /56 so one host cannot rotate addresses).
const keyByUserOrIp = (req: Request) => req.auth?.id ?? ipKeyGenerator(req.ip ?? '');

const handler = (_req: Request, _res: unknown, next: (e: unknown) => void) =>
  next(new AppError(429, 'RATE_LIMITED', 'Too many requests. Try again in a moment.'));

/** Auth endpoints: 10 attempts per minute per IP. */
export const authLimiter = rateLimit({
  windowMs: 60_000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => handler(req, res, next),
});

/** Code / password-reset sends: 5 per 15 minutes per IP. */
export const sendCodeLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res, next) => handler(req, res, next),
});

/** General API: 120 per minute per user. */
export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  handler: (req, res, next) => handler(req, res, next),
});

/** AI endpoints: 20 per minute per user (daily quotas are enforced separately). */
export const aiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByUserOrIp,
  handler: (req, res, next) => handler(req, res, next),
});
