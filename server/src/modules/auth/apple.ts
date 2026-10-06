import { SignJWT, createRemoteJWKSet, importPKCS8, jwtVerify } from 'jose';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import { config } from '../../config.js';
import { AppError } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

const APPLE_ISSUER = 'https://appleid.apple.com';
const appleJwks = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));

export interface AppleIdentity {
  sub: string;
  email?: string;
  emailVerified: boolean;
  isPrivateEmail: boolean;
}

/** Verifies the identity token the app receives from `expo-apple-authentication`. */
export async function verifyAppleIdentityToken(identityToken: string): Promise<AppleIdentity> {
  try {
    const { payload } = await jwtVerify(identityToken, appleJwks, { issuer: APPLE_ISSUER, audience: config.APPLE_BUNDLE_ID });
    if (!payload.sub) throw new Error('no sub');
    const emailVerified = payload.email_verified === true || payload.email_verified === 'true';
    return {
      sub: payload.sub,
      email: typeof payload.email === 'string' ? payload.email.toLowerCase() : undefined,
      emailVerified,
      isPrivateEmail: payload.is_private_email === true || payload.is_private_email === 'true',
    };
  } catch (e) {
    logger.warn({ err: e }, 'apple identity token rejected');
    throw new AppError(401, 'TOKEN_INVALID', 'Apple sign-in could not be verified.');
  }
}

const appleConfigured = () => !!(config.APPLE_TEAM_ID && config.APPLE_KEY_ID && config.APPLE_PRIVATE_KEY);

/** Client secret JWT (ES256) required by Apple's token and revoke endpoints. */
async function appleClientSecret() {
  const key = await importPKCS8(config.APPLE_PRIVATE_KEY!.replace(/\\n/g, '\n'), 'ES256');
  return new SignJWT({})
    .setProtectedHeader({ alg: 'ES256', kid: config.APPLE_KEY_ID! })
    .setIssuer(config.APPLE_TEAM_ID!)
    .setAudience(APPLE_ISSUER)
    .setSubject(config.APPLE_BUNDLE_ID)
    .setIssuedAt()
    .setExpirationTime('5m')
    .sign(key);
}

/**
 * Exchanges the one-time authorization code for a refresh token so the account
 * can later be revoked at Apple when the user deletes their FRIDGR account.
 * Returns null when Apple keys are not configured (dev) or the exchange fails.
 */
export async function exchangeAppleAuthorizationCode(code: string): Promise<string | null> {
  if (!appleConfigured()) return null;
  try {
    const body = new URLSearchParams({
      client_id: config.APPLE_BUNDLE_ID,
      client_secret: await appleClientSecret(),
      code,
      grant_type: 'authorization_code',
    });
    const res = await fetch('https://appleid.apple.com/auth/token', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    if (!res.ok) {
      logger.warn({ status: res.status }, 'apple code exchange failed');
      return null;
    }
    const json = (await res.json()) as { refresh_token?: string };
    return json.refresh_token ?? null;
  } catch (e) {
    logger.warn({ err: e }, 'apple code exchange error');
    return null;
  }
}

/** Revokes the Apple refresh token (App Store guideline 5.1.1(v)). */
export async function revokeAppleToken(refreshToken: string): Promise<boolean> {
  if (!appleConfigured()) return false;
  try {
    const body = new URLSearchParams({
      client_id: config.APPLE_BUNDLE_ID,
      client_secret: await appleClientSecret(),
      token: refreshToken,
      token_type_hint: 'refresh_token',
    });
    const res = await fetch('https://appleid.apple.com/auth/revoke', { method: 'POST', body, headers: { 'content-type': 'application/x-www-form-urlencoded' } });
    return res.ok;
  } catch (e) {
    logger.warn({ err: e }, 'apple revoke error');
    return false;
  }
}

// ---- at-rest encryption for the Apple refresh token (AES-256-GCM, key derived from the refresh secret)
const encKey = createHash('sha256').update(`apple-token:${config.BETTER_AUTH_SECRET}`).digest();

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encKey, iv);
  const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
  return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${enc.toString('base64url')}`;
}

export function decryptSecret(packed: string) {
  const [iv, tag, data] = packed.split('.');
  if (!iv || !tag || !data) throw new Error('bad ciphertext');
  const decipher = createDecipheriv('aes-256-gcm', encKey, Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(data, 'base64url')), decipher.final()]).toString('utf8');
}
