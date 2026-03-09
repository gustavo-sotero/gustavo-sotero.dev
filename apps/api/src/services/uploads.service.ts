/**
 * Uploads service — presign URL generation, confirmation and status management.
 *
 * Flow:
 *  1. generatePresignedUrl() — create DB record (pending) + presigned PUT URL
 *  2. confirmUpload() — validate object in bucket → update to 'uploaded' → enqueue imageOptimize
 */

import { OutboxEventType } from '@portfolio/shared';
import { outbox, uploads } from '@portfolio/shared/db/schema';
import { and, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { getLogger } from '../config/logger';
import { getPublicUrl, s3 } from '../config/s3';
import { createUpload, findUploadById } from '../repositories/uploads.repo';

export type UploadRecord = NonNullable<Awaited<ReturnType<typeof findUploadById>>>;

/** Type of a confirmed upload — inferred from the uploads table row. */
export type ConfirmedUpload = typeof uploads.$inferSelect;

const logger = getLogger('services', 'uploads');

/** MIME → file extension map for S3 key generation. */
const MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

export interface PresignResult {
  presignedUrl: string;
  key: string;
  uploadId: string;
}

/**
 * Generate a presigned PUT URL for direct upload to S3.
 * Creates an `uploads` record with status='pending'.
 */
export async function generatePresignedUrl(input: {
  mime: string;
  size: number;
  filename: string;
}): Promise<PresignResult> {
  if (!input.filename?.trim()) {
    throw Object.assign(new Error('Filename is required'), { code: 'VALIDATION_ERROR' });
  }

  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > 5_242_880) {
    throw Object.assign(new Error('File size must be between 1 byte and 5MB'), {
      code: 'VALIDATION_ERROR',
    });
  }

  const ext = MIME_TO_EXT[input.mime];

  if (!ext) {
    throw Object.assign(new Error('Unsupported MIME type'), { code: 'VALIDATION_ERROR' });
  }

  const now = new Date();
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const uuid = crypto.randomUUID();
  const key = `uploads/${yyyy}/${mm}/${uuid}.${ext}`;

  // Generate presigned PUT URL (10 min expiry)
  const presignedUrl = s3.file(key).presign({
    method: 'PUT',
    expiresIn: 600,
    type: input.mime,
  });

  const originalUrl = getPublicUrl(key);

  const record = await createUpload({
    storageKey: key,
    originalUrl,
    mime: input.mime,
    size: input.size,
    status: 'pending',
  });

  if (!record) {
    throw new Error('Failed to create upload record');
  }

  logger.info('Presigned URL generated', { uploadId: record.id, key, mime: input.mime });

  return {
    presignedUrl,
    key,
    uploadId: record.id,
  };
}

/**
 * Get an upload record by ID.
 * Throws 'NOT_FOUND' if the record does not exist.
 */
export async function getUploadById(uploadId: string): Promise<UploadRecord> {
  const record = await findUploadById(uploadId);
  if (!record) {
    throw Object.assign(new Error('Upload not found'), { code: 'NOT_FOUND' });
  }
  return record;
}

/**
 * Confirm a completed upload.
 *
 * Validates the object exists in S3, then atomically:
 *  1. Updates status `pending → uploaded` with a WHERE guard to prevent
 *     concurrent requests from double-processing the same upload (TOCTOU fix).
 *  2. Inserts an outbox event `image-optimize` so the worker relay reliably
 *     delivers the job even if the process crashes after the DB write.
 *
 * @throws 'NOT_FOUND'           if upload ID does not exist
 * @throws 'CONFLICT'            if status is not 'pending' (concurrent request won)
 * @throws 'NOT_FOUND_IN_BUCKET' if object is missing from S3
 */
export async function confirmUpload(uploadId: string): Promise<ConfirmedUpload> {
  const record = await findUploadById(uploadId);
  if (!record) {
    throw Object.assign(new Error('Upload not found'), { code: 'NOT_FOUND' });
  }

  if (record.status !== 'pending') {
    throw Object.assign(new Error(`Upload is already in status '${record.status}'`), {
      code: 'CONFLICT',
    });
  }

  // Verify object exists in S3 before opening the transaction.
  const exists = await s3.file(record.storageKey).exists();
  if (!exists) {
    throw Object.assign(new Error('File not found in storage'), { code: 'NOT_FOUND_IN_BUCKET' });
  }

  // Atomic transaction:
  //   a) Update status only if still 'pending' — the WHERE guard prevents duplicate
  //      processing if two concurrent requests pass the pre-check above.
  //   b) Insert outbox event atomically, guaranteeing the job reaches the worker
  //      even if the process crashes between the DB write and a direct queue publish.
  const updated = await db.transaction(async (tx) => {
    const [row] = await tx
      .update(uploads)
      .set({ status: 'uploaded' })
      .where(and(eq(uploads.id, uploadId), eq(uploads.status, 'pending')))
      .returning();

    if (!row) return null;

    await tx.insert(outbox).values({
      eventType: OutboxEventType.IMAGE_OPTIMIZE,
      payload: { uploadId },
    });

    return row;
  });

  if (!updated) {
    // Another concurrent request already updated the status — treat as conflict.
    throw Object.assign(new Error('Upload was already processed by a concurrent request'), {
      code: 'CONFLICT',
    });
  }

  logger.info('Upload confirmed, outbox event written', { uploadId, key: record.storageKey });

  return updated;
}
