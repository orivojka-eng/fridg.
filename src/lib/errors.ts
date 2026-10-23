/** A user-facing message for any thrown value. */
export const errorMessage = (e: unknown, fallback = 'Something went wrong. Try again.') =>
  e instanceof Error && e.message ? e.message : fallback;
