import { randomUUID } from 'node:crypto';
import { betterAuth } from 'better-auth';
import { prismaAdapter } from 'better-auth/adapters/prisma';
import { APIError, createAuthMiddleware } from 'better-auth/api';
import { bearer, emailOTP } from 'better-auth/plugins';
import { config } from './config.js';
import { prisma } from './db.js';
import { hashPassword, verifyPassword } from './lib/crypto.js';
import {
  emailUsable,
  sendPasswordChangedEmail,
  sendPasswordResetCodeEmail,
  sendPasswordResetEmail,
  sendSecurityAlertEmail,
  sendVerificationEmail,
} from './lib/email.js';
import { logger } from './lib/logger.js';
import { requestScope } from './lib/requestScope.js';

/**
 * Authentication: Better Auth on our Prisma/Neon database.
 *  - email + password (argon2id, so pre-existing hashes keep working)
 *  - 6-digit email codes for verification, reset links for passwords (lib/email.ts)
 *  - native Sign in with Apple (identity token from the iPhone), optional Google
 *  - bearer tokens for the mobile app (stored in the device keychain)
 * Endpoints live under /api/auth/*. FRIDGR's own API (/v1) reads the same session.
 */
const baseURL = config.BETTER_AUTH_URL ?? `http://localhost:${config.PORT}`;

const googleClientIds = [config.GOOGLE_CLIENT_ID_WEB, config.GOOGLE_CLIENT_ID_IOS, config.GOOGLE_CLIENT_ID_ANDROID].filter((v): v is string => !!v);

/** Unique public handle from a first name: "sofiacooks", "sofiacooks4821"… */
async function uniqueHandle(firstName: string) {
  const base = (firstName.toLowerCase().replace(/[^a-z0-9]/g, '') || 'cook').slice(0, 16) + 'cooks';
  for (let i = 0; i < 20; i++) {
    const candidate = i === 0 ? base : `${base}${Math.floor(Math.random() * 9000 + 1000)}`;
    if (!(await prisma.user.findUnique({ where: { handle: candidate }, select: { id: true } }))) return candidate;
  }
  return `${base}${randomUUID().slice(0, 8)}`;
}

const CODE_MINUTES = 10;
const EMAIL_PATHS = new Set(['/sign-up/email', '/email-otp/send-verification-otp', '/request-password-reset', '/email-otp/request-password-reset']);
const RESET_LINK_MINUTES = 30;

/** Sends that must not reveal whether an account exists run in the background; failures are logged. */
const background = (what: string, p: Promise<unknown>) => void p.catch((e) => logger.error({ err: (e as Error).message }, `${what} email failed`));

const audit = (userId: string | null, action: string, meta?: Record<string, unknown>) =>
  prisma.auditLog.create({ data: { userId, action, meta: meta as object | undefined } }).catch((e) => logger.warn({ err: e }, 'audit failed'));

export const auth = betterAuth({
  appName: 'FRIDGR',
  baseURL,
  basePath: '/api/auth',
  secret: config.BETTER_AUTH_SECRET,
  database: prismaAdapter(prisma, { provider: 'postgresql' }),
  telemetry: { enabled: false },
  trustedOrigins: [...config.corsOrigins, 'fridgr://', baseURL],

  advanced: {
    database: { generateId: () => randomUUID() },
    // Set by app.ts from Express's proxy-aware req.ip (see TRUST_PROXY_HOPS).
    ipAddress: { ipAddressHeaders: ['x-fridgr-client-ip'] },
    cookiePrefix: 'fridgr',
    useSecureCookies: config.isProd,
  },

  session: {
    expiresIn: config.SESSION_DAYS * 86_400,
    updateAge: 86_400, // sliding: active users stay signed in
  },

  user: {
    additionalFields: {
      firstName: { type: 'string', required: false, input: true },
      lastName: { type: 'string', required: false, input: true },
      handle: { type: 'string', required: false, input: false },
    },
  },

  // Sign-up sends the 6-digit code (the email-OTP plugin replaces the default link).
  emailVerification: {
    sendOnSignUp: true,
    autoSignInAfterVerification: true,
  },

  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6,
    maxPasswordLength: 128,
    autoSignIn: true,
    // The app keeps unverified users on the code screen; the API's data routes require verification.
    requireEmailVerification: false,
    password: {
      hash: (password) => hashPassword(password),
      verify: ({ hash, password }) => verifyPassword(hash, password).catch(() => false),
    },
    resetPasswordTokenExpiresIn: RESET_LINK_MINUTES * 60,
    revokeSessionsOnPasswordReset: true,
    // Background send: the response is identical (and as fast) whether or not the email has an account.
    sendResetPassword: async ({ user, url }) => {
      background('reset link', sendPasswordResetEmail({ to: user.email, name: user.name, url, minutes: RESET_LINK_MINUTES }));
    },
    onPasswordReset: async ({ user }) => {
      await audit(user.id, 'auth.password_reset');
      background('password reset notice', sendPasswordChangedEmail({ to: user.email, name: user.name, how: 'reset' }));
    },
  },

  socialProviders: {
    // Native iOS: the app sends Apple's identity token; audience = the bundle id.
    apple: {
      clientId: config.APPLE_BUNDLE_ID,
      appBundleIdentifier: config.APPLE_BUNDLE_ID,
    },
    // Native Google sign-in: the app sends Google's ID token; any of our client ids is an accepted audience.
    ...(googleClientIds.length ? { google: { clientId: googleClientIds } } : {}),
  },

  account: {
    // Apple/Google with the same verified email join the existing account.
    accountLinking: { enabled: true, trustedProviders: ['apple', 'google'] },
  },

  rateLimit: {
    enabled: true,
    window: 60,
    max: 100,
    customRules: {
      '/sign-in/email': { window: 60, max: 10 },
      '/sign-up/email': { window: 60, max: 5 },
      '/sign-in/social': { window: 60, max: 10 },
      '/email-otp/send-verification-otp': { window: 300, max: 3 },
      '/email-otp/verify-email': { window: 60, max: 10 },
      '/request-password-reset': { window: 900, max: 5 },
      '/reset-password': { window: 60, max: 10 },
      '/email-otp/request-password-reset': { window: 900, max: 5 },
      '/email-otp/reset-password': { window: 60, max: 10 },
      '/change-password': { window: 60, max: 5 },
      '/delete-user': { window: 60, max: 5 },
    },
  },

  hooks: {
    // Without any email provider (outside development) nothing that depends on email can work: say so
    // up front, identically for every address, instead of answering "sent".
    before: createAuthMiddleware(async (ctx) => {
      if (!EMAIL_PATHS.has(ctx.path) || emailUsable()) return;
      throw new APIError('SERVICE_UNAVAILABLE', { code: 'EMAIL_UNAVAILABLE', message: 'Email is temporarily unavailable, so we cannot send codes right now. Please try again later.' });
    }),
    after: createAuthMiddleware(async (ctx) => {
      // "Resend code" whose email did not go out: report it rather than claiming success.
      if (ctx.path === '/email-otp/send-verification-otp' && requestScope.getStore()?.emailFailed) {
        throw new APIError('BAD_GATEWAY', { code: 'EMAIL_SEND_FAILED', message: 'We could not send the code. Try again in a minute.' });
      }
      // Tell the owner whenever the password changes while signed in.
      if (ctx.path !== '/change-password') return;
      const returned = ctx.context.returned as { user?: { id: string; email: string; name?: string } } | Error | undefined;
      if (!returned || returned instanceof Error || !returned.user) return;
      await audit(returned.user.id, 'auth.password_changed');
      background('password changed notice', sendPasswordChangedEmail({ to: returned.user.email, name: returned.user.name, how: 'change' }));
    }),
  },

  plugins: [
    bearer(),
    emailOTP({
      otpLength: 6,
      expiresIn: CODE_MINUTES * 60,
      allowedAttempts: 5,
      storeOTP: 'hashed',
      overrideDefaultEmailVerification: true,
      // Codes are only ever logged by lib/email.ts in APP_ENV=development without a provider.
      sendVerificationOTP: async ({ email, otp, type }) => {
        if (type === 'forget-password') {
          background('reset code', sendPasswordResetCodeEmail({ to: email, code: otp, minutes: CODE_MINUTES }));
          return;
        }
        const user = await prisma.user.findUnique({ where: { email }, select: { firstName: true, name: true } });
        try {
          await sendVerificationEmail({ to: email, name: user?.firstName ?? user?.name, code: otp, minutes: CODE_MINUTES });
        } catch (e) {
          // Sign-up still succeeds (the app offers "Resend code"); an explicit resend reports the failure
          // through the after-hook, because errors thrown here are swallowed by Better Auth.
          const scope = requestScope.getStore();
          if (scope) scope.emailFailed = true;
          logger.error({ err: (e as Error).message }, 'verification email failed');
        }
      },
    }),
  ],

  databaseHooks: {
    user: {
      create: {
        // Fill FRIDGR's required fields from whatever the sign-up method provided.
        before: async (user) => {
          const parts = String(user.name ?? '').trim().split(/\s+/).filter(Boolean);
          const firstName = String(user.firstName ?? '').trim() || parts[0] || 'Chef';
          const lastName = String(user.lastName ?? '').trim() || parts.slice(1).join(' ');
          const name = `${firstName} ${lastName}`.trim();
          return { data: { ...user, firstName, lastName, name, email: String(user.email).toLowerCase(), handle: await uniqueHandle(firstName) } };
        },
        // Every account starts with an empty profile, Food Profile and shopping list.
        after: async (user) => {
          await prisma.$transaction([
            prisma.userProfile.upsert({ where: { userId: user.id }, create: { userId: user.id, bio: 'New in the kitchen' }, update: {} }),
            prisma.foodProfile.upsert({ where: { userId: user.id }, create: { userId: user.id }, update: {} }),
          ]);
          if (!(await prisma.shoppingList.findFirst({ where: { userId: user.id, isDefault: true } }))) {
            await prisma.shoppingList.create({ data: { userId: user.id, name: 'My list', isDefault: true } });
          }
          await audit(user.id, 'auth.register');
        },
      },
    },
    account: {
      create: {
        /**
         * Takeover guard: if someone registered this email with a password
         * but never proved they own it, and the real owner now signs in with
         * Apple/Google, the unverified password is removed.
         */
        before: async (account) => {
          if (account.providerId === 'credential') return;
          const user = await prisma.user.findUnique({ where: { id: account.userId }, select: { emailVerified: true } });
          if (user && !user.emailVerified) {
            const { count } = await prisma.account.deleteMany({ where: { userId: account.userId, providerId: 'credential' } });
            if (count) {
              await prisma.session.deleteMany({ where: { userId: account.userId } });
              await audit(account.userId, 'auth.unverified_password_removed', { provider: account.providerId });
              const owner = await prisma.user.findUnique({ where: { id: account.userId }, select: { email: true, name: true } });
              const via = account.providerId === 'apple' ? 'Apple' : account.providerId === 'google' ? 'Google' : account.providerId;
              if (owner) {
                background('security notice', sendSecurityAlertEmail({
                  to: owner.email,
                  name: owner.name,
                  title: 'An unconfirmed password was removed',
                  message: `You signed in with ${via}. Someone had added a password to this email address without confirming it, so that password was removed and those sessions were signed out. Only ${via} sign-in works now; you can set a new password from Log in > Forgot password.`,
                }));
              }
            }
          }
          await audit(account.userId, `auth.${account.providerId}_linked`);
        },
      },
    },
    session: {
      create: {
        after: async (session) => {
          await prisma.user.update({ where: { id: session.userId }, data: { lastSeenAt: new Date() } }).catch(() => undefined);
          await audit(session.userId, 'auth.sign_in', { ua: session.userAgent?.slice(0, 120) });
        },
      },
    },
  },
});

export type AuthSession = typeof auth.$Infer.Session;
