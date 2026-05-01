/**
 * Admin routes for comment moderation and management.
 *
 * Routes:
 *  GET    /admin/comments                     - Paginated list (status, deleted, postId filters)
 *  POST   /admin/comments/reply               - Admin-authored reply
 *  PATCH  /admin/comments/:id/status          - Reversible status transition
 *  PATCH  /admin/comments/:id/content         - Edit comment content (re-render + sanitize)
 *  DELETE /admin/comments/:id                 - Soft delete
 *
 * Legacy compat (maps to status transitions):
 *  POST   /admin/comments/:id/approve         - status=approved
 *  POST   /admin/comments/:id/reject          - status=rejected
 */

import {
  adminCommentQuerySchema,
  adminReplyCommentSchema,
  adminSoftDeleteCommentSchema,
  adminUpdateCommentContentSchema,
  adminUpdateCommentStatusSchema,
} from '@portfolio/shared/schemas/comments';
import { Hono } from 'hono';
import { DomainValidationError, NotFoundError } from '../../lib/errors';
import { parseBodyOrEmpty } from '../../lib/requestBody';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import { parseAndValidateBody, validateOptionalBody, validateQuery } from '../../lib/validate';
import {
  approveComment,
  createAdminReply,
  editCommentContent,
  listAdminComments,
  moderateCommentStatus,
  rejectComment,
  removeComment,
} from '../../services/comments.admin.service';
import type { AppEnv } from '../../types/index';

const adminCommentsRouter = new Hono<AppEnv>();

// -- Error mapper -----------------------------------------------------------

function handleCommentServiceError(c: Parameters<typeof errorResponse>[0], err: unknown) {
  if (err instanceof NotFoundError) {
    return errorResponse(c, 404, 'NOT_FOUND', err.message);
  }
  if (err instanceof DomainValidationError) {
    return errorResponse(c, 409, 'CONFLICT', err.message);
  }
  throw err;
}

// -- Routes -----------------------------------------------------------------

/**
 * GET /admin/comments
 * Paginated list. Accepts ?status=pending|approved|rejected, ?deleted=true, ?postId=N.
 */
adminCommentsRouter.get('/', async (c) => {
  const qv = validateQuery(c, adminCommentQuerySchema, {
    page: c.req.query('page'),
    perPage: c.req.query('perPage'),
    status: c.req.query('status'),
    deleted: c.req.query('deleted'),
    postId: c.req.query('postId'),
  });
  if (!qv.ok) return qv.response;

  const { data, meta } = await listAdminComments(qv.data);
  return paginatedResponse(c, data, meta);
});

/**
 * POST /admin/comments/reply
 * Creates an admin-authored reply. Automatically approved.
 */
adminCommentsRouter.post('/reply', async (c) => {
  const bv = await parseAndValidateBody(c, adminReplyCommentSchema);
  if (!bv.ok) return bv.response;

  const adminId = c.get('adminId') as string;

  try {
    const newComment = await createAdminReply(bv.data, adminId);
    return successResponse(c, newComment, 201);
  } catch (err) {
    return handleCommentServiceError(c, err);
  }
});

/**
 * PATCH /admin/comments/:id/status
 * Reversible status transition: pending | approved | rejected.
 */
adminCommentsRouter.patch('/:id/status', async (c) => {
  const { id } = c.req.param();
  const adminId = c.get('adminId') as string;

  const bv = await parseAndValidateBody(c, adminUpdateCommentStatusSchema);
  if (!bv.ok) return bv.response;

  try {
    const updated = await moderateCommentStatus(id, bv.data.status, adminId);
    return successResponse(c, updated);
  } catch (err) {
    return handleCommentServiceError(c, err);
  }
});

/**
 * PATCH /admin/comments/:id/content
 * Edit the content of any comment. Re-runs sanitize pipeline.
 */
adminCommentsRouter.patch('/:id/content', async (c) => {
  const { id } = c.req.param();
  const adminId = c.get('adminId') as string;

  const bv = await parseAndValidateBody(c, adminUpdateCommentContentSchema);
  if (!bv.ok) return bv.response;

  try {
    const updated = await editCommentContent(id, bv.data.content, bv.data.reason, adminId);
    return successResponse(c, updated);
  } catch (err) {
    return handleCommentServiceError(c, err);
  }
});

/**
 * DELETE /admin/comments/:id
 * Soft-deletes a comment. Body accepts optional { reason }.
 */
adminCommentsRouter.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const adminId = c.get('adminId') as string;

  const body = await parseBodyOrEmpty(c);
  const bv = validateOptionalBody(c, adminSoftDeleteCommentSchema, body);
  if (!bv.ok) return bv.response;

  try {
    const deleted = await removeComment(id, bv.data.reason, adminId);
    return successResponse(c, deleted);
  } catch (err) {
    return handleCommentServiceError(c, err);
  }
});

// -- Legacy endpoints (convenience maps to status PATCH) -------------------

/** POST /admin/comments/:id/approve -> set status=approved */
adminCommentsRouter.post('/:id/approve', async (c) => {
  const { id } = c.req.param();
  const adminId = c.get('adminId') as string;

  try {
    const updated = await approveComment(id, adminId);
    return successResponse(c, updated);
  } catch (err) {
    return handleCommentServiceError(c, err);
  }
});

/** POST /admin/comments/:id/reject -> set status=rejected */
adminCommentsRouter.post('/:id/reject', async (c) => {
  const { id } = c.req.param();
  const adminId = c.get('adminId') as string;

  try {
    const updated = await rejectComment(id, adminId);
    return successResponse(c, updated);
  } catch (err) {
    return handleCommentServiceError(c, err);
  }
});

export { adminCommentsRouter };
