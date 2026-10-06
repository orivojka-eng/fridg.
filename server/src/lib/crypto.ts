import { createHash, createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import argon2 from 'argon2';

export const sha256 = (value: string) => createHash('sha256').update(value).digest('hex');

export const hmacSha256 = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('hex');

export const randomToken = (bytes = 48) => randomBytes(bytes).toString('base64url');

/** Six-digit numeric code, cryptographically random. */
export const sixDigitCode = () => String(randomInt(0, 1_000_000)).padStart(6, '0');

export const hashPassword = (password: string) =>
  argon2.hash(password, { type: argon2.argon2id, memoryCost: 19456, timeCost: 2, parallelism: 1 });

export const verifyPassword = (hash: string, password: string) => argon2.verify(hash, password);

export const safeEqual = (a: string, b: string) => {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};
