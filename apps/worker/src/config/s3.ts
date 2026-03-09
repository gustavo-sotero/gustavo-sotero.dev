/**
 * Native Bun S3 client for the Worker process.
 * Used to download originals and upload optimized variants.
 */

import { env } from './env';

export const s3 = new Bun.S3Client({
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
  endpoint: env.S3_ENDPOINT,
  bucket: env.S3_BUCKET,
});

/** Build a public-facing URL for a given S3 key. */
export function getPublicUrl(key: string): string {
  const domain = env.S3_PUBLIC_DOMAIN.replace(/\/+$/, '');
  const normalizedKey = key.replace(/^\/+/, '');
  const domainLastSegment = domain.split('/').filter(Boolean).at(-1);

  if (domainLastSegment && normalizedKey.startsWith(`${domainLastSegment}/`)) {
    return `${domain}/${normalizedKey.slice(domainLastSegment.length + 1)}`;
  }

  return `${domain}/${normalizedKey}`;
}
