import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request scratch space for Better Auth callbacks. Better Auth swallows
 * errors thrown inside its email callbacks, so the callback records the
 * failure here and an `after` hook turns it into an error response.
 */
export interface RequestScope {
  emailFailed?: boolean;
}

export const requestScope = new AsyncLocalStorage<RequestScope>();
