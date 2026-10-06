import { GetObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';

const configured = !!(config.S3_ENDPOINT && config.S3_BUCKET && config.S3_ACCESS_KEY_ID && config.S3_SECRET_ACCESS_KEY);

const s3 = configured
  ? new S3Client({ region: 'auto', endpoint: config.S3_ENDPOINT, credentials: { accessKeyId: config.S3_ACCESS_KEY_ID!, secretAccessKey: config.S3_SECRET_ACCESS_KEY! }, forcePathStyle: true })
  : null;

export const storageConfigured = () => configured;

const contentTypes: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };

/** Signed PUT for a scan photo. Keys under scans/ are auto-deleted by a bucket lifecycle rule after 24 h. */
export async function signScanUpload(userId: string, ext: 'jpg' | 'png' | 'webp' = 'jpg') {
  if (!s3) return null;
  const key = `scans/${userId}/${randomUUID()}.${ext}`;
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: config.S3_BUCKET!, Key: key, ContentType: contentTypes[ext] }), { expiresIn: 300 });
  return { key, url, contentType: contentTypes[ext]!, method: 'PUT' as const, expiresInSec: 300 };
}

/** Short-lived GET so the vision model can read a private object. */
export async function signRead(key: string) {
  if (!s3) return null;
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: config.S3_BUCKET!, Key: key }), { expiresIn: 300 });
}

/** Signed PUT for a recipe cover photo (kept for the life of the recipe). */
export async function signCoverUpload(userId: string, ext: 'jpg' | 'png' | 'webp' = 'jpg') {
  if (!s3) return null;
  const key = `covers/${userId}/${randomUUID()}.${ext}`;
  const url = await getSignedUrl(s3, new PutObjectCommand({ Bucket: config.S3_BUCKET!, Key: key, ContentType: contentTypes[ext] }), { expiresIn: 300 });
  const publicUrl = config.S3_PUBLIC_BASE_URL ? `${config.S3_PUBLIC_BASE_URL.replace(/\/$/, '')}/${key}` : null;
  return { key, url, contentType: contentTypes[ext]!, method: 'PUT' as const, expiresInSec: 300, publicUrl };
}
