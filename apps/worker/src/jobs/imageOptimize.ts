/**
 * BullMQ job handler: imageOptimize
 *
 * Processes an uploaded image using `sharp`:
 *  1. Validate S3 object metadata (size, MIME) before loading bytes
 *  2. Download original from S3
 *  3. Detect animated GIF (preserve format)
 *  4. Generate thumbnail (400w WebP) and medium (800w WebP)
 *  5. Upload variants to S3
 *  6. Update `uploads` record → status='processed' + variant URLs + dimensions
 *
 * On error: update status='failed' and rethrow for BullMQ retry/DLQ.
 */

import { MAX_UPLOAD_BYTES } from '@portfolio/shared/constants/uploads';
import { uploads } from '@portfolio/shared/db/schema';
import type { Job } from 'bullmq';
import { eq } from 'drizzle-orm';
import sharp from 'sharp';
import { db } from '../config/db';
import { getLogger } from '../config/logger';
import { getPublicUrl, s3 } from '../config/s3';

const logger = getLogger('jobs', 'imageOptimize');

/** Accepted image MIME types for processing. */
const SUPPORTED_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

export interface ImageOptimizePayload {
  uploadId: string;
}

export async function processImageOptimize(job: Job<ImageOptimizePayload>): Promise<void> {
  const { uploadId } = job.data;
  const startedAt = Date.now();

  logger.info('Image optimization started', {
    uploadId,
    jobId: job.id,
    attempt: job.attemptsMade + 1,
  });

  // 1. Fetch upload record
  const [record] = await db.select().from(uploads).where(eq(uploads.id, uploadId)).limit(1);

  if (!record) {
    throw new Error(`Upload record not found: ${uploadId}`);
  }

  try {
    if (!record.storageKey) {
      throw new Error(`Upload ${uploadId} is missing storageKey`);
    }

    const key = record.storageKey;

    // 2. Defensive validation: fetch S3 metadata before loading full bytes.
    //    Guards against legacy records, DB manipulation, outbox replay, and
    //    storage mutation between confirm and worker processing.
    const stat = await s3.file(key).stat();

    if (!stat) {
      throw new Error(`Upload object not found in storage: ${key}`);
    }

    if (stat.size > MAX_UPLOAD_BYTES) {
      throw new Error(
        `Upload object exceeds maximum allowed size: ${stat.size} bytes (max ${MAX_UPLOAD_BYTES})`
      );
    }

    const actualMime = stat.type?.split(';')[0]?.trim() ?? '';
    if (actualMime && !SUPPORTED_MIMES.has(actualMime)) {
      throw new Error(`Upload object has unsupported MIME type: ${actualMime}`);
    }

    if (record.mime && actualMime && actualMime !== record.mime) {
      throw new Error(
        `Upload object MIME type ${actualMime} does not match upload record MIME type ${record.mime}`
      );
    }

    const originalBytes = await s3.file(key).bytes();

    // 3. Load into buffer for sharp processing
    const buffer = Buffer.from(originalBytes);

    // 4. Read metadata
    const metadata = await sharp(buffer).metadata();
    const { width, height, pages } = metadata;

    // 5. Detect animated GIF — skip WebP conversion, preserve original format
    const isAnimatedGif = record.mime === 'image/gif' && (pages ?? 0) > 1;

    const now = new Date();
    const yyyy = now.getUTCFullYear();
    const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
    const baseName =
      key
        .split('/')
        .pop()
        ?.replace(/\.[^.]+$/, '') ?? crypto.randomUUID();

    let thumbUrl: string;
    let mediumUrl: string;

    if (isAnimatedGif) {
      // Preserve GIF format for animated variants while still generating 400w/800w sizes
      const thumbKey = `${yyyy}/${mm}/${baseName}_thumb.gif`;
      const mediumKey = `${yyyy}/${mm}/${baseName}_medium.gif`;

      const [thumbBuffer, mediumBuffer] = await Promise.all([
        sharp(buffer, { animated: true })
          .resize(400, undefined, { withoutEnlargement: true })
          .gif()
          .toBuffer(),
        sharp(buffer, { animated: true })
          .resize(800, undefined, { withoutEnlargement: true })
          .gif()
          .toBuffer(),
      ]);

      await Promise.all([
        s3.file(thumbKey).write(thumbBuffer, { type: 'image/gif' }),
        s3.file(mediumKey).write(mediumBuffer, { type: 'image/gif' }),
      ]);

      thumbUrl = getPublicUrl(thumbKey);
      mediumUrl = getPublicUrl(mediumKey);

      logger.debug('Animated GIF detected — variants preserved as GIF', {
        uploadId,
        thumbKey,
        mediumKey,
      });
    } else {
      // 6. Generate WebP variants
      const thumbKey = `${yyyy}/${mm}/${baseName}_thumb.webp`;
      const mediumKey = `${yyyy}/${mm}/${baseName}_medium.webp`;

      const [thumbBuffer, mediumBuffer] = await Promise.all([
        sharp(buffer)
          .resize(400, undefined, { withoutEnlargement: true })
          .webp({ quality: 80 })
          .toBuffer(),
        sharp(buffer)
          .resize(800, undefined, { withoutEnlargement: true })
          .webp({ quality: 85 })
          .toBuffer(),
      ]);

      await Promise.all([
        s3.file(thumbKey).write(thumbBuffer, { type: 'image/webp' }),
        s3.file(mediumKey).write(mediumBuffer, { type: 'image/webp' }),
      ]);

      thumbUrl = getPublicUrl(thumbKey);
      mediumUrl = getPublicUrl(mediumKey);

      logger.debug('WebP variants generated', { uploadId, thumbKey, mediumKey });
    }

    // 7. Update DB record
    await db
      .update(uploads)
      .set({
        optimizedUrl: mediumUrl,
        variants: { thumbnail: thumbUrl, medium: mediumUrl },
        width: width ?? null,
        height: height ?? null,
        status: 'processed',
      })
      .where(eq(uploads.id, uploadId));

    const durationMs = Date.now() - startedAt;
    logger.info('Image optimization completed', {
      uploadId,
      jobId: job.id,
      durationMs,
      width,
      height,
      isAnimatedGif,
    });
  } catch (err) {
    const maxAttempts = job.opts.attempts ?? 3;
    const currentAttempt = job.attemptsMade + 1;
    const isFinalAttempt = currentAttempt >= maxAttempts;

    // Mark as failed only when retries are exhausted (definitive/non-recoverable failure)
    if (isFinalAttempt) {
      await db
        .update(uploads)
        .set({ status: 'failed' })
        .where(eq(uploads.id, uploadId))
        .catch((dbErr) => {
          logger.error('Failed to update upload status to failed', {
            uploadId,
            error: (dbErr as Error).message,
          });
        });
    }

    logger.error('Image optimization failed', {
      uploadId,
      jobId: job.id,
      attempt: currentAttempt,
      maxAttempts,
      isFinalAttempt,
      error: (err as Error).message,
    });

    throw err; // Rethrow so BullMQ can retry / move to DLQ
  }
}
