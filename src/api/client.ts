import { Platform } from 'react-native';
import { env } from '../config/env';
import { httpFetch, NetworkError, networkMessage } from './http';
import { tokenStore } from './tokens';

export type ApiErrorCode =
  | 'VALIDATION'
  | 'UNAUTHENTICATED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'RATE_LIMITED'
  | 'QUOTA_EXCEEDED'
  | 'PREMIUM_REQUIRED'
  | 'INVALID_CODE'
  | 'CODE_EXPIRED'
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_NOT_VERIFIED'
  | 'TOKEN_INVALID'
  | 'NOT_IMPLEMENTED'
  | 'UPSTREAM'
  | 'INTERNAL'
  | 'NETWORK';

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ApiErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export const isApiError = (e: unknown): e is ApiError => e instanceof ApiError;

/** A user-facing message for any thrown value. */
export const errorMessage = (e: unknown, fallback = 'Something went wrong. Try again.') =>
  isApiError(e) ? e.message : e instanceof Error && e.message ? e.message : fallback;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Skip the Authorization header (auth endpoints). */
  anonymous?: boolean;
  /** Raw bytes (file upload); sent as-is with `contentType`. */
  raw?: Blob;
  contentType?: string;
  /** Internal: prevents a second refresh attempt. */
  _retried?: boolean;
  signal?: AbortSignal;
}

type Listener = () => void;
const sessionLostListeners = new Set<Listener>();
/** Fired when the refresh token is rejected: the store logs the user out. */
export const onSessionLost = (fn: Listener) => {
  sessionLostListeners.add(fn);
  return () => sessionLostListeners.delete(fn);
};

let refreshing: Promise<boolean> | null = null;

/**
 * Better Auth sessions slide forward while the app is used, so there is no
 * refresh token: a 401 means the session ended (signed out elsewhere,
 * password reset, account deleted) and the user is signed out locally.
 */
async function refreshTokens(): Promise<boolean> {
  return false;
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { accept: 'application/json' };
  if (opts.raw) headers['content-type'] = opts.contentType ?? 'application/octet-stream';
  else if (opts.body !== undefined) headers['content-type'] = 'application/json';
  if (!opts.anonymous) {
    const access = await tokenStore.getAccess();
    if (access) headers.authorization = `Bearer ${access}`;
  }
  let res: Response;
  try {
    res = await httpFetch(`${env.API_URL}/v1${path}`, {
      method: opts.method ?? (opts.body !== undefined || opts.raw ? 'POST' : 'GET'),
      headers,
      body: opts.raw ?? (opts.body !== undefined ? JSON.stringify(opts.body) : undefined),
      signal: opts.signal,
    });
  } catch (e) {
    if (e instanceof NetworkError) throw new ApiError(0, 'NETWORK', networkMessage(e));
    throw e;
  }

  if (res.status === 401 && !opts.anonymous && !opts._retried) {
    const ok = await refreshTokens();
    if (ok) return request<T>(path, { ...opts, _retried: true });
    await tokenStore.clear();
    sessionLostListeners.forEach((fn) => fn());
  }

  const text = await res.text();
  const json = text ? safeJson(text) : null;
  if (!res.ok) {
    const err = (json as { error?: { code?: ApiErrorCode; message?: string; details?: unknown } } | null)?.error;
    throw new ApiError(res.status, err?.code ?? 'INTERNAL', err?.message ?? `Request failed (${res.status}).`, err?.details);
  }
  return json as T;
}

const safeJson = (text: string) => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => request<T>(path, { method: 'GET', signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
