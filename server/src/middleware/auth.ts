import type { NextFunction, Request, Response } from 'express';
import { fromNodeHeaders } from 'better-auth/node';
import { auth } from '../auth.js';
import { prisma } from '../db.js';
import { AppError } from '../lib/errors.js';

export interface AuthUser {
  id: string;
  sessionId: string;
  email: string;
  emailVerified: boolean;
  isPremium: boolean;
}

declare module 'express-serve-static-core' {
  interface Request {
    auth?: AuthUser;
  }
}

/**
 * Reads the Better Auth session from `Authorization: Bearer <token>` (the
 * mobile app) or the session cookie (web). Returns null when signed out.
 */
async function resolve(req: Request): Promise<AuthUser | null> {
  const hasCredentials = !!req.headers.authorization || !!req.headers.cookie;
  if (!hasCredentials) return null;
  const result = await auth.api.getSession({ headers: fromNodeHeaders(req.headers) }).catch(() => null);
  if (!result) {
    if (req.headers.authorization) throw new AppError(401, 'TOKEN_INVALID', 'Your session expired. Sign in again.');
    return null;
  }
  const extra = await prisma.user.findUnique({
    where: { id: result.user.id },
    select: { subscription: { select: { isActive: true } }, deletion: { select: { status: true } } },
  });
  if (!extra || extra.deletion) return null;
  return {
    id: result.user.id,
    sessionId: result.session.id,
    email: result.user.email,
    emailVerified: result.user.emailVerified,
    isPremium: !!extra.subscription?.isActive,
  };
}

/** Requires a signed-in user. */
export async function requireAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await resolve(req);
    if (!user) throw AppError.unauthenticated();
    req.auth = user;
    next();
  } catch (e) {
    next(e);
  }
}

/** Requires a signed-in user with a confirmed email. */
export async function requireVerified(req: Request, res: Response, next: NextFunction) {
  await requireAuth(req, res, (err?: unknown) => {
    if (err) return next(err);
    if (!req.auth?.emailVerified) return next(new AppError(403, 'EMAIL_NOT_VERIFIED', 'Confirm your email first.'));
    next();
  });
}

export function requirePremium(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth?.isPremium) return next(new AppError(402, 'PREMIUM_REQUIRED', 'This is a Premium feature.'));
  next();
}

/** Attaches the user when a valid session is present, never fails. */
export async function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  try {
    const user = await resolve(req);
    if (user) req.auth = user;
  } catch {
    /* anonymous */
  }
  next();
}

export const authUser = (req: Request): AuthUser => {
  if (!req.auth) throw AppError.unauthenticated();
  return req.auth;
};
