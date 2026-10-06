import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db.js';
import { verifyPassword } from '../../lib/crypto.js';
import { sendAccountDeletedEmail, sendDataExportEmail } from '../../lib/email.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { authUser, requireAuth } from '../../middleware/auth.js';
import { authLimiter, sendCodeLimiter } from '../../middleware/rateLimit.js';
import { body, wrap } from '../../middleware/validate.js';
import { decryptSecret, encryptSecret, exchangeAppleAuthorizationCode, revokeAppleToken } from '../auth/apple.js';

export const accountRouter = Router();
accountRouter.use(requireAuth);

/**
 * In-app account deletion (App Store guideline 5.1.1(v)).
 * 1. re-authenticate (password, or explicit confirmation for social-only accounts)
 * 2. revoke Apple tokens
 * 3. revoke all sessions
 * 4. hard-delete the user: every personal table cascades from User
 * 5. keep one anonymised audit row so support can answer "was my account deleted?"
 */
accountRouter.post(
  '/delete',
  authLimiter,
  body(z.object({ password: z.string().max(128).optional(), confirm: z.literal('DELETE'), reason: z.string().trim().max(300).optional() })),
  wrap(async (req, res) => {
    const { id, email } = authUser(req);
    const user = await prisma.user.findUniqueOrThrow({ where: { id }, include: { accounts: true } });
    const credential = user.accounts.find((a) => a.providerId === 'credential' && a.password);
    if (credential?.password) {
      if (!req.body.password || !(await verifyPassword(credential.password, req.body.password))) {
        throw new AppError(401, 'INVALID_CREDENTIALS', 'Enter your password to delete the account.');
      }
    }
    await prisma.accountDeletionRequest.upsert({
      where: { userId: id },
      create: { userId: id, status: 'processing', scheduledFor: new Date(), reason: req.body.reason },
      update: { status: 'processing', reason: req.body.reason },
    });

    let appleRevoked = false;
    for (const account of user.accounts) {
      if (account.providerId === 'apple' && account.refreshToken) {
        try {
          appleRevoked = (await revokeAppleToken(decryptSecret(account.refreshToken))) || appleRevoked;
        } catch (e) {
          logger.warn({ err: e, userId: id }, 'apple revoke failed');
        }
      }
    }

    await prisma.session.deleteMany({ where: { userId: id } });
    await prisma.$transaction([
      prisma.auditLog.create({ data: { userId: null, action: 'account.deleted', meta: { appleRevoked, hadApple: user.accounts.some((a) => a.providerId === 'apple') } } }),
      prisma.user.delete({ where: { id } }),
    ]);
    sendAccountDeletedEmail({ to: email }).catch((e) => logger.warn({ err: e }, 'deletion email failed'));
    res.json({ ok: true, appleRevoked });
  }),
);

/**
 * After a native Sign in with Apple the app sends Apple's one-time
 * authorization code. We exchange it for a refresh token and keep it
 * encrypted, so deleting the account can revoke FRIDGR at Apple
 * (App Store guideline 5.1.1(v)).
 */
accountRouter.post(
  '/apple-token',
  authLimiter,
  body(z.object({ authorizationCode: z.string().min(10).max(2000) })),
  wrap(async (req, res) => {
    const { id } = authUser(req);
    const account = await prisma.account.findFirst({ where: { userId: id, providerId: 'apple' } });
    if (!account) throw AppError.notFound('Apple sign-in');
    const refresh = await exchangeAppleAuthorizationCode(req.body.authorizationCode);
    if (refresh) await prisma.account.update({ where: { id: account.id }, data: { refreshToken: encryptSecret(refresh) } });
    res.json({ ok: true, stored: !!refresh });
  }),
);

/** Everything we hold about the user. Secrets (passwords, tokens) are never included. */
async function buildExport(id: string) {
  const user = await prisma.user.findUniqueOrThrow({
    where: { id },
    include: {
      profile: true,
      foodProfile: { include: { allergies: true, dislikes: true, cuisines: true } },
      accounts: { select: { providerId: true, createdAt: true } },
      sessions: { select: { createdAt: true, expiresAt: true, userAgent: true } },
      fridgeItems: true,
      recipes: { include: { ingredients: true, steps: true } },
      ratings: true,
      saved: true,
      likes: true,
      comments: true,
      following: true,
      followers: true,
      collections: { include: { recipes: true } },
      shoppingLists: { include: { items: true } },
      cookingSessions: true,
      notifications: true,
      signals: true,
      subscription: true,
      importedRecipes: { include: { source: true } },
    },
  });
  return { exportedAt: new Date().toISOString(), user };
}

/** GDPR-style export, downloaded directly. */
accountRouter.get(
  '/export',
  wrap(async (req, res) => {
    const data = await buildExport(authUser(req).id);
    res.setHeader('content-disposition', 'attachment; filename="fridgr-export.json"');
    res.json(data);
  }),
);

/** Same export, emailed as a JSON attachment to the account address. */
accountRouter.post(
  '/export/email',
  sendCodeLimiter,
  wrap(async (req, res) => {
    const { id, email } = authUser(req);
    const data = await buildExport(id);
    await sendDataExportEmail({ to: email, name: data.user.firstName ?? data.user.name, json: JSON.stringify(data, null, 2) });
    await prisma.auditLog.create({ data: { userId: id, action: 'account.export_emailed' } });
    res.json({ ok: true, sentTo: email });
  }),
);
