export type ErrorCode =
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
  | 'INTERNAL';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, details?: unknown) {
    return new AppError(400, 'VALIDATION', message, details);
  }
  static unauthenticated(message = 'Sign in to continue.') {
    return new AppError(401, 'UNAUTHENTICATED', message);
  }
  static forbidden(message = 'You cannot do that.') {
    return new AppError(403, 'FORBIDDEN', message);
  }
  static notFound(what = 'Resource') {
    return new AppError(404, 'NOT_FOUND', `${what} not found.`);
  }
  static conflict(message: string) {
    return new AppError(409, 'CONFLICT', message);
  }
  static notImplemented(feature: string) {
    return new AppError(501, 'NOT_IMPLEMENTED', `${feature} is not available yet.`);
  }
}
