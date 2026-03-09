import { env } from './env';

// Native Bun S3 client — supports MinIO, R2, AWS S3 and other S3-compatible services
// No external AWS SDK required — Bun has built-in S3 support
export const s3 = new Bun.S3Client({
  accessKeyId: env.S3_ACCESS_KEY,
  secretAccessKey: env.S3_SECRET_KEY,
  endpoint: env.S3_ENDPOINT,
  bucket: env.S3_BUCKET,
});

/**
 * Build the public URL for a given S3 key.
 * S3_PUBLIC_DOMAIN is the CDN/public hostname (e.g. cdn.yourdomain.com or localhost:9000/bucket).
 */
export function getPublicUrl(key: string): string {
  const domain = env.S3_PUBLIC_DOMAIN.replace(/\/+$/, '');
  const normalizedKey = key.replace(/^\/+/, '');
  const domainLastSegment = domain.split('/').filter(Boolean).at(-1);

  if (domainLastSegment && normalizedKey.startsWith(`${domainLastSegment}/`)) {
    return `${domain}/${normalizedKey.slice(domainLastSegment.length + 1)}`;
  }

  return `${domain}/${normalizedKey}`;
}
