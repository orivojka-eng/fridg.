import { Platform } from 'react-native';
import { env } from '../config/env';
import { api, ApiError, isApiError, type ApiErrorCode } from './client';
import { httpFetch, NetworkError, networkMessage } from './http';
import { tokenStore } from './tokens';
import type { ServerUser } from './types';

/**
 * Authentication against Better Auth (/api/auth/*) on the FRIDGR server.
 * Better Auth returns a session token (header `set-auth-token`, or `token`
 * in the body); it is kept in the device keychain and sent as
 * `Authorization: Bearer` to both Better Auth and the FRIDGR API (/v1).
 * Method names are unchanged so stores and screens did not need to change.
 */

// Better Auth error codes → the app's existing error codes (screens already handle these).
const CODE_MAP: Record<string, ApiErrorCode> = {
  INVALID_EMAIL_OR_PASSWORD: 'INVALID_CREDENTIALS',
  INVALID_PASSWORD: 'INVALID_CREDENTIALS',
  USER_ALREADY_EXISTS: 'CONFLICT',
  USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: 'CONFLICT',
  INVALID_OTP: 'INVALID_CODE',
  OTP_EXPIRED: 'CODE_EXPIRED',
  TOO_MANY_ATTEMPTS: 'CODE_EXPIRED',
  INVALID_TOKEN: 'TOKEN_INVALID',
  PASSWORD_TOO_SHORT: 'VALIDATION',
  PASSWORD_TOO_LONG: 'VALIDATION',
  INVALID_EMAIL: 'VALIDATION',
};

const FRIENDLY: Partial<Record<ApiErrorCode, string>> = {
  INVALID_CREDENTIALS: 'Email or password is wrong.',
  CONFLICT: 'An account with this email already exists. Try signing in.',
  INVALID_CODE: 'That code is not right.',
  CODE_EXPIRED: 'That code expired. Tap "Resend code".',
  TOKEN_INVALID: 'Sign-in could not be verified. Try again.',
  RATE_LIMITED: 'Too many attempts. Wait a minute and try again.',
};

/** Remembered so code screens can resend without asking for the email again. */
let lastEmail: string | undefined;

async function authCall<T>(path: string, body: unknown, opts: { auth?: boolean } = {}): Promise<{ data: T; token?: string }> {
  const headers: Record<string, string> = { 'content-type': 'application/json', accept: 'application/json' };
  if (opts.auth) {
    const token = await tokenStore.getAccess();
    if (token) headers.authorization = `Bearer ${token}`;
  }
  let res: Response;
  try {
    res = await httpFetch(`${env.API_URL}/api/auth${path}`, { method: 'POST', headers, body: JSON.stringify(body ?? {}) });
  } catch (e) {
    throw new ApiError(0, 'NETWORK', e instanceof NetworkError ? networkMessage(e) : 'No connection. Check your internet and try again.');
  }
  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    /* non-JSON error page */
  }
  if (!res.ok) {
    const raw = String(json.code ?? '');
    const code: ApiErrorCode = res.status === 429 ? 'RATE_LIMITED' : res.status >= 500 ? 'UPSTREAM' : CODE_MAP[raw] ?? (res.status === 401 ? 'INVALID_CREDENTIALS' : 'VALIDATION');
    // Server messages are written for users (e.g. "We could not send the code"); fall back for HTML error pages.
    throw new ApiError(res.status, code, FRIENDLY[code] ?? (typeof json.message === 'string' && json.message ? json.message : res.status >= 500 ? 'The FRIDGR server could not finish that. Try again in a minute.' : 'Something went wrong. Try again.'));
  }
  const token = res.headers.get('set-auth-token') ?? (typeof json.token === 'string' ? json.token : undefined);
  return { data: json as T, token };
}

async function keep(token?: string) {
  if (token) await tokenStore.set(token, '');
}

const me = async () => (await api.get<{ user: ServerUser }>('/users/me')).user;

export const authApi = {
  async register(input: { email: string; password: string; firstName: string; lastName: string }) {
    const { token } = await authCall('/sign-up/email', {
      email: input.email,
      password: input.password,
      name: `${input.firstName} ${input.lastName}`.trim(),
      firstName: input.firstName,
      lastName: input.lastName,
    });
    await keep(token);
    lastEmail = input.email;
    return me();
  },

  async login(email: string, password: string) {
    const { token } = await authCall('/sign-in/email', { email, password });
    await keep(token);
    lastEmail = email;
    return me();
  },

  /** Native Sign in with Apple: Better Auth verifies Apple's identity token; the authorization code lets the server revoke access on deletion. */
  async apple(input: { identityToken: string; authorizationCode?: string | null; fullName?: { givenName?: string | null; familyName?: string | null } | null }) {
    const name = input.fullName?.givenName || input.fullName?.familyName ? { firstName: input.fullName?.givenName ?? undefined, lastName: input.fullName?.familyName ?? undefined } : undefined;
    const { token } = await authCall('/sign-in/social', { provider: 'apple', idToken: { token: input.identityToken, ...(name ? { user: { name } } : {}) } });
    await keep(token);
    if (input.authorizationCode) await api.post('/account/apple-token', { authorizationCode: input.authorizationCode }).catch(() => undefined);
    const user = await me();
    lastEmail = user.email;
    return { user, created: !user.hasOnboarded };
  },

  async google(idToken: string) {
    const { token } = await authCall('/sign-in/social', { provider: 'google', idToken: { token: idToken } });
    await keep(token);
    const user = await me();
    lastEmail = user.email;
    return { user, created: !user.hasOnboarded };
  },

  async verifyEmail(code: string, email?: string) {
    const address = email ?? lastEmail;
    if (!address) throw new ApiError(400, 'VALIDATION', 'Sign in again to confirm your email.');
    const { token } = await authCall('/email-otp/verify-email', { email: address, otp: code }, { auth: true });
    await keep(token);
    return me();
  },

  async resendCode(email?: string) {
    const address = email ?? lastEmail;
    if (!address) return;
    await authCall('/email-otp/send-verification-otp', { email: address, type: 'email-verification' });
  },

  /**
   * Emails a reset link that opens the hosted reset page (no app screen needed).
   * The answer is the same whether or not the email has an account.
   */
  forgotPassword: (email: string) => authCall('/request-password-reset', { email, redirectTo: `${env.API_URL}/reset-password` }).then(() => ({ ok: true as const })),

  resetPassword: (token: string, password: string) => authCall('/reset-password', { token, newPassword: password }).then(() => ({ ok: true as const })),

  changePassword: (currentPassword: string, password: string) =>
    authCall('/change-password', { currentPassword, newPassword: password, revokeOtherSessions: true }, { auth: true }).then(async ({ token }) => {
      await keep(token);
      return { ok: true as const };
    }),

  me,

  /**
   * Returns the user when the stored session is still valid, otherwise null.
   * Only a definite "session ended" (401) deletes the stored token; no signal or a
   * sleeping server keeps it, so the next launch signs the user straight back in.
   */
  async restore(): Promise<ServerUser | null> {
    if (!(await tokenStore.getAccess())) return null;
    try {
      const user = await me();
      lastEmail = user.email;
      return user;
    } catch (e) {
      if (isApiError(e) && e.status === 401) await tokenStore.clear();
      return null;
    }
  },

  async logout() {
    try {
      await authCall('/sign-out', {}, { auth: true });
    } catch {
      /* the local session is cleared regardless */
    }
    lastEmail = undefined;
    await tokenStore.clear();
  },

  async deleteAccount(password: string | undefined, reason?: string) {
    await api.post<{ ok: true }>('/account/delete', { password, confirm: 'DELETE', reason });
    lastEmail = undefined;
    await tokenStore.clear();
  },
};

/** Platform label kept for analytics/support context. */
export const authPlatform = Platform.OS;
