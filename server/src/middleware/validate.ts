import type { NextFunction, Request, Response } from 'express';
import type { ZodTypeAny, z } from 'zod';
import { AppError } from '../lib/errors.js';

type Source = 'body' | 'query' | 'params';

/**
 * Validates one part of the request with a Zod schema and replaces it with the
 * parsed (typed, defaulted, stripped) value. Unknown keys are dropped.
 */
export function validate<S extends ZodTypeAny>(source: Source, schema: S) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);
    if (!result.success) {
      const details = result.error.issues.map((i) => ({ path: i.path.join('.'), message: i.message }));
      return next(AppError.badRequest(details[0]?.message ?? 'Invalid request.', details));
    }
    (req as any)[source] = result.data;
    next();
  };
}

export const body = <S extends ZodTypeAny>(schema: S) => validate('body', schema);
export const query = <S extends ZodTypeAny>(schema: S) => validate('query', schema);
export const params = <S extends ZodTypeAny>(schema: S) => validate('params', schema);

export type Parsed<S extends ZodTypeAny> = z.infer<S>;

/** Wraps an async handler so rejections reach the error middleware. */
export const wrap =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>) =>
  (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
