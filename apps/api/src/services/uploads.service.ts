/**
 * Uploads service — presign URL generation, confirmation and status management.
 *
 * Flow:
 *  1. generatePresignedUrl() — create DB record (pending) + presigned PUT URL
 *  2. confirmUpload() — validate object in bucket → update to 'uploaded' → write outbox event
 */

import { OutboxEventType } from '@portfolio/shared/constants/enums';
import { outbox, uploads } from '@portfolio/shared/db/schema';
import { and, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { getLogger } from '../config/logger';
import { getPublicUrl, s3 } from '../config/s3';
import { ConflictError, DomainValidationError, NotFoundError } from '../lib/errors';
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

/**
 * Maximum tolerance ratio between declared and actual object size.
 * Actual size must be within this factor of the declared size.
 */
const SIZE_TOLERANCE_RATIO = 0.05; // 5%

/**
 * Read the minimum number of bytes needed for image magic-byte validation.
 * WebP requires 12 bytes (4 RIFF + 4 size + 4 WEBP).
 */
const MAGIC_BYTES_PREFIX_SIZE = 12;

/**
 * Validate image magic bytes against the declared MIME type.
 * Returns an error string on mismatch, null on success.
 */
function validateImageMagicBytes(bytes: Uint8Array, mime: string): string | null {
  if (bytes.length < 4) return 'Image file is too small to validate';

  switch (mime) {
    case 'image/jpeg':
      if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return null;
      return 'File does not match JPEG signature';

    case 'image/png':
      if (
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47 &&
        bytes[4] === 0x0d &&
        bytes[5] === 0x0a &&
        bytes[6] === 0x1a &&
        bytes[7] === 0x0a
      )
        return null;
      return 'File does not match PNG signature';

    case 'image/gif':
      if (
        bytes[0] === 0x47 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x38 &&
        (bytes[4] === 0x37 || bytes[4] === 0x39) &&
        bytes[5] === 0x61
      )
        return null;
      return 'File does not match GIF signature';

    case 'image/webp':
      // RIFF....WEBP
      if (
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      )
        return null;
      return 'File does not match WebP signature';

    default:
      return null; // unknown MIME — skip magic check
  }
}

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
    throw new DomainValidationError('Filename is required', [
      { field: 'filename', message: 'Filename is required' },
    ]);
  }

  if (!Number.isInteger(input.size) || input.size <= 0 || input.size > 5_242_880) {
    throw new DomainValidationError('File size must be between 1 byte and 5MB', [
      { field: 'size', message: 'File size must be between 1 byte and 5MB' },
    ]);
  }

  const ext = MIME_TO_EXT[input.mime];

  if (!ext) {
    throw new DomainValidationError('Unsupported MIME type', [
      { field: 'mime', message: 'Unsupported MIME type' },
    ]);
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
    throw new NotFoundError('Upload not found');
  }
  return record;
}

/**
 * Confirm a completed upload.
 *
 * Validates the object exists in S3, checks actual size and content-type
 * metadata against the declared values, validates image magic bytes, then
 * atomically:
 *  1. Updates status `pending → uploaded` with a WHERE guard to prevent
 *     concurrent requests from double-processing the same upload (TOCTOU fix).
 *  2. Inserts an outbox event `image-optimize` so the worker relay reliably
 *     delivers the job even if the process crashes after the DB write.
 *
 * @throws 'NOT_FOUND'           if upload ID does not exist
 * @throws 'CONFLICT'            if status is not 'pending' (concurrent request won)
 * @throws 'NOT_FOUND_IN_BUCKET' if object is missing from S3
 * @throws 'DomainValidationError' if actual object metadata or image bytes mismatch
 */
export async function confirmUpload(uploadId: string): Promise<ConfirmedUpload> {
  const record = await findUploadById(uploadId);
  if (!record) {
    throw new NotFoundError('Upload not found');
  }

  if (record.status !== 'pending') {
    throw new ConflictError(`Upload is already in status '${record.status}'`);
  }

  // Verify object exists and fetch metadata in a single S3 stat call.
  const stat = await s3.file(record.storageKey).stat();
  if (!stat) {
    throw new NotFoundError('File not found in storage — upload the file before confirming.');
  }

  // Validate actual stored size against declared size (allow up to SIZE_TOLERANCE_RATIO drift
  // to accommodate multi-part upload padding differences).
  const declaredSize = record.size;
  const actualSize = stat.size;
  const sizeDelta = Math.abs(actualSize - declaredSize) / Math.max(declaredSize, 1);
  if (sizeDelta > SIZE_TOLERANCE_RATIO) {
    logger.warn('Upload confirmation rejected: size mismatch', {
      uploadId,
      declaredSize,
      actualSize,
      sizeDelta: sizeDelta.toFixed(3),
    });
    throw new DomainValidationError(
      `Uploaded file size (${actualSize} bytes) does not match declared size (${declaredSize} bytes)`,
      [{ field: 'size', message: 'Actual file size does not match declared size' }]
    );
  }

  // Validate actual content-type against declared MIME when the S3 provider returns it.
  const actualMime = stat.type?.split(';')[0]?.trim() ?? '';
  if (actualMime && actualMime !== record.mime) {
    logger.warn('Upload confirmation rejected: MIME mismatch', {
      uploadId,
      declaredMime: record.mime,
      actualMime,
    });
    throw new DomainValidationError(
      `Uploaded file type (${actualMime}) does not match declared MIME type (${record.mime})`,
      [{ field: 'mime', message: 'Actual file type does not match declared MIME type' }]
    );
  }

  // Read the minimum prefix for magic-byte image signature validation.
  // Uses a range request to avoid loading the full object into memory here.
  const prefixBlob = await s3.file(record.storageKey).slice(0, MAGIC_BYTES_PREFIX_SIZE);
  const prefixBuffer = await prefixBlob.arrayBuffer();
  const prefixBytes = new Uint8Array(prefixBuffer);

  const magicError = validateImageMagicBytes(prefixBytes, record.mime);
  if (magicError) {
    logger.warn('Upload confirmation rejected: magic byte mismatch', {
      uploadId,
      mime: record.mime,
      reason: magicError,
    });
    throw new DomainValidationError(magicError, [{ field: 'file', message: magicError }]);
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
    throw new ConflictError('Upload was already processed by a concurrent request');
  }

  logger.info('Upload confirmed, outbox event written', { uploadId, key: record.storageKey });

  return updated;
}
