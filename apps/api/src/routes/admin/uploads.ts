/**
 * Admin routes for image uploads management.
 *
 * Protected by `authAdmin` + CSRF middleware applied globally in app.ts.
 *
 * Routes:
 *  GET   /admin/uploads/:id          - Get upload status and metadata (poll for optimization)
 *  POST  /admin/uploads/presign      - Request presigned PUT URL for direct S3 upload
 *  POST  /admin/uploads/:id/confirm  - Confirm completed upload → trigger optimization pipeline
 */

import { presignRequestSchema } from '@portfolio/shared/schemas/uploads';
import { Hono } from 'hono';
import { parseBodyResult } from '../../lib/requestBody';
import { errorResponse, successResponse } from '../../lib/response';
import { confirmUpload, generatePresignedUrl, getUploadById } from '../../services/uploads.service';
import type { AppEnv } from '../../types/index';

export const adminUploadsRouter = new Hono<AppEnv>();

type UploadResponse = Omit<Awaited<ReturnType<typeof getUploadById>>, 'storageKey'>;

function serializeUpload(upload: Awaited<ReturnType<typeof getUploadById>>): UploadResponse {
  const { storageKey: _storageKey, ...response } = upload;
  return response;
}

/**
 * GET /admin/uploads/:id
 * Get the current status and metadata of an upload by ID.
 * Use this to poll for optimization completion after confirming an upload.
 *
 * Returns the full upload record including `status`, `optimizedUrl` and `variants`.
 *
 * Error cases:
 *  404 — upload ID not found
 */
adminUploadsRouter.get('/:id', async (c) => {
  const id = c.req.param('id');

  try {
    const upload = await getUploadById(id);
    return successResponse(c, serializeUpload(upload));
  } catch (err) {
    const error = err as Error & { code?: string };
    if (error.code === 'NOT_FOUND') {
      return errorResponse(c, 404, 'NOT_FOUND', 'Upload not found');
    }
    throw err;
  }
});

/**
 * POST /admin/uploads/presign
 * Generate a presigned PUT URL for a direct browser-to-S3 upload.
 * Creates an `uploads` record with status='pending'.
 *
 * Validates:
 *  - mime: must be one of image/jpeg, image/png, image/webp, image/gif
 *  - size: must be ≤ 5MB
 *  - filename: required
 */
adminUploadsRouter.post('/presign', async (c) => {
  const bodyResult = await parseBodyResult(c);
  if (!bodyResult.ok) {
    return errorResponse(
      c,
      400,
      'VALIDATION_ERROR',
      bodyResult.error.message,
      bodyResult.error.details
    );
  }

  const parsed = presignRequestSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    const details = parsed.error.issues.map((i) => ({
      field: i.path.join('.'),
      message: i.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  try {
    const result = await generatePresignedUrl(parsed.data);
    return successResponse(c, result, 201);
  } catch (err) {
    const error = err as Error & { code?: string };
    if (error.code === 'VALIDATION_ERROR') {
      return errorResponse(c, 400, 'VALIDATION_ERROR', error.message);
    }
    throw err;
  }
});

/**
 * POST /admin/uploads/:id/confirm
 * Confirm that a file was successfully uploaded to the bucket.
 *
 * Transitions upload status: pending → uploaded.
 * Enqueues the `image-optimize` BullMQ job for async processing.
 *
 * Error cases:
 *  404 — upload ID not found
 *  409 — upload not in 'pending' state
 *  404 — file not present in S3 bucket
 */
adminUploadsRouter.post('/:id/confirm', async (c) => {
  const id = c.req.param('id');

  try {
    const upload = await confirmUpload(id);
    return successResponse(c, {
      ...serializeUpload(upload),
      message: 'Upload confirmado com sucesso.',
    });
  } catch (err) {
    const error = err as Error & { code?: string };

    if (error.code === 'NOT_FOUND') {
      return errorResponse(c, 404, 'NOT_FOUND', 'Upload not found');
    }
    if (error.code === 'CONFLICT') {
      return errorResponse(c, 409, 'CONFLICT', error.message);
    }
    if (error.code === 'NOT_FOUND_IN_BUCKET') {
      return errorResponse(
        c,
        404,
        'NOT_FOUND',
        'File not found in storage. Upload the file before confirming.'
      );
    }

    throw err;
  }
});
