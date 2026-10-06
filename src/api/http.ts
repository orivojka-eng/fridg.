import { env } from '../config/env';

/**
 * Network layer shared by the FRIDGR API client and the auth client.
 *
 * The production API runs on Render's free plan, which sleeps after 15 minutes
 * without traffic and needs ~30-60 s to wake. To make that invisible:
 *  - every attempt has a timeout, so a dead connection never hangs forever;
 *  - reads (GET) are retried while the server wakes up;
 *  - writes (POST/PUT/...) are never retried blindly (they could run twice):
 *    instead the server is woken first with a cheap /health/live ping when it
 *    has not answered recently.
 */

const ATTEMPT_TIMEOUT_MS = 25_000;
const WAKE_BUDGET_MS = 75_000;
const AWAKE_FOR_MS = 10 * 60_000;

let lastOkAt = 0;
let waking: Promise<boolean> | null = null;

export class NetworkError extends Error {
  constructor(public readonly kind: 'offline' | 'timeout' | 'waking') {
    super(kind);
    this.name = 'NetworkError';
  }
}

export const networkMessage = (e: NetworkError) =>
  e.kind === 'waking' || e.kind === 'timeout'
    ? 'The FRIDGR server is waking up. Try again in a few seconds.'
    : 'No connection. Check your internet and try again.';

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** One fetch with a timeout. Network failures become NetworkError. */
async function attempt(url: string, init: RequestInit, timeoutMs = ATTEMPT_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const outer = init.signal;
  const onAbort = () => controller.abort();
  outer?.addEventListener?.('abort', onAbort);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal });
    if (res.status < 500 || res.status === 501) lastOkAt = Date.now();
    return res;
  } catch (e) {
    if (outer?.aborted) throw e;
    throw new NetworkError(controller.signal.aborted ? 'timeout' : 'offline');
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener?.('abort', onAbort);
  }
}

/** Render answers 502/503 while an instance boots. */
const isWakingStatus = (status: number) => status === 502 || status === 503 || status === 504;

/** Resolves true once the server answers /health/live (or immediately if it answered recently). */
export function wakeServer(): Promise<boolean> {
  if (Date.now() - lastOkAt < AWAKE_FOR_MS) return Promise.resolve(true);
  if (waking) return waking;
  waking = (async () => {
    const until = Date.now() + WAKE_BUDGET_MS;
    let delay = 1500;
    while (Date.now() < until) {
      try {
        const res = await attempt(`${env.API_URL}/health/live`, { method: 'GET' }, 15_000);
        if (res.ok) return true;
      } catch (e) {
        // Offline (not just sleeping): stop early, the caller shows "no connection".
        if (e instanceof NetworkError && e.kind === 'offline' && delay > 6000) return false;
      }
      await sleep(delay);
      delay = Math.min(delay * 1.6, 8000);
    }
    return false;
  })().finally(() => {
    waking = null;
  });
  return waking;
}

/** Fire-and-forget at app launch so the server is warm before the user taps anything. */
export const warmUpServer = () => {
  if (env.USE_BACKEND) void wakeServer();
};

/**
 * fetch() with timeout + cold-start handling. GETs retry until the server is up;
 * other methods wake the server first and are then sent exactly once.
 */
export async function httpFetch(url: string, init: RequestInit): Promise<Response> {
  const method = (init.method ?? 'GET').toUpperCase();
  if (method !== 'GET') {
    await wakeServer();
    return attempt(url, init);
  }
  const until = Date.now() + WAKE_BUDGET_MS;
  let delay = 1500;
  for (;;) {
    try {
      const res = await attempt(url, init);
      if (!isWakingStatus(res.status) || Date.now() > until) return res;
    } catch (e) {
      if (!(e instanceof NetworkError) || Date.now() > until) throw e instanceof NetworkError ? new NetworkError('waking') : e;
      // A phone with no connection fails instantly; give up after a couple of tries.
      if (e.kind === 'offline' && delay > 4000) throw e;
    }
    await sleep(delay);
    delay = Math.min(delay * 1.6, 8000);
  }
}
