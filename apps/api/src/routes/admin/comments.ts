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
 *  POST   /admin/comments/:id/approve         - → status=approved
 *  POST   /admin/comments/:id/reject          - → status=rejected
 */

import { comments, posts } from '@portfolio/shared/db/schema';
import {
  adminCommentQuerySchema,
  adminReplyCommentSchema,
  adminSoftDeleteCommentSchema,
  adminUpdateCommentContentSchema,
  adminUpdateCommentStatusSchema,
} from '@portfolio/shared/schemas/comments';
import { and, asc, count, eq, isNotNull, isNull, type SQL } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { invalidateGroup } from '../../lib/cache';
import { renderCommentMarkdown } from '../../lib/markdownComment';
import { buildPaginationMeta, parsePagination } from '../../lib/pagination';
import { parseBodyOrEmpty, parseBodyResult } from '../../lib/requestBody';
import { errorResponse, paginatedResponse, successResponse } from '../../lib/response';
import { validateBody, validateOptionalBody, validateQuery } from '../../lib/validate';
import {
  findCommentById,
  softDeleteComment,
  updateCommentContent,
  updateCommentStatus,
} from '../../repositories/comments.repo';
import type { AppEnv } from '../../types/index';

const adminCommentsRouter = new Hono<AppEnv>();

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

  const { page: pageRaw, perPage: perPageRaw, status, deleted, postId } = qv.data;
  const { page, perPage, offset, limit } = parsePagination({
    page: pageRaw,
    perPage: perPageRaw,
  });

  const conditions: SQL[] = [];

  if (status) {
    conditions.push(eq(comments.status, status));
  }

  if (postId !== undefined) {
    conditions.push(eq(comments.postId, postId));
  }

  if (deleted === true) {
    conditions.push(isNotNull(comments.deletedAt));
  } else {
    conditions.push(isNull(comments.deletedAt));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(comments).where(where),
    db
      .select({
        id: comments.id,
        postId: comments.postId,
        postTitle: posts.title,
        parentCommentId: comments.parentCommentId,
        authorName: comments.authorName,
        authorEmail: comments.authorEmail,
        authorRole: comments.authorRole,
        content: comments.content,
        renderedContent: comments.renderedContent,
        status: comments.status,
        ipHash: comments.ipHash,
        createdAt: comments.createdAt,
        moderatedAt: comments.moderatedAt,
        moderatedBy: comments.moderatedBy,
        editedAt: comments.editedAt,
        editedBy: comments.editedBy,
        editReason: comments.editReason,
        deletedAt: comments.deletedAt,
        deletedBy: comments.deletedBy,
        deleteReason: comments.deleteReason,
      })
      .from(comments)
      .leftJoin(posts, eq(comments.postId, posts.id))
      .where(where)
      .orderBy(asc(comments.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = countResult[0]?.total ?? 0;
  const meta = buildPaginationMeta(total, page, perPage);

  return paginatedResponse(c, rows, meta);
});

/**
 * POST /admin/comments/reply
 * Creates an admin-authored reply to an existing comment.
 * Automatically approved — no moderation round-trip needed.
 */
adminCommentsRouter.post('/reply', async (c) => {
  const bodyResult = await parseBodyResult(c);
  const bv = validateBody(c, adminReplyCommentSchema, bodyResult);
  if (!bv.ok) return bv.response;

  const adminId = c.get('adminId') as string;
  const payload = bv.data;

  // Verify parent exists and belongs to the stated post
  const parent = await findCommentById(payload.parentCommentId);
  if (!parent) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Parent comment not found');
  }
  if (parent.postId !== payload.postId) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Parent comment belongs to a different post');
  }
  if (parent.deletedAt !== null) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Cannot reply to a deleted comment');
  }

  // Verify post exists
  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, payload.postId), isNull(posts.deletedAt)))
    .limit(1);

  if (!post) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Post not found');
  }

  const renderedContent = await renderCommentMarkdown(payload.content);

  const [newComment] = await db
    .insert(comments)
    .values({
      postId: payload.postId,
      parentCommentId: payload.parentCommentId,
      authorName: env.ADMIN_DISPLAY_NAME,
      // Use the JWT-derived adminId (GitHub ID from the authenticated session) rather
      // than the env var, so the record is tied to the actual authenticated principal.
      authorEmail: `admin:${adminId}`,
      authorRole: 'admin',
      content: payload.content,
      renderedContent,
      status: 'approved',
      moderatedBy: adminId,
      moderatedAt: new Date(),
    })
    .returning();

  await invalidateGroup('commentsModeration');

  return successResponse(c, newComment, 201);
});

/**
 * PATCH /admin/comments/:id/status
 * Reversible status transition: pending | approved | rejected.
 */
adminCommentsRouter.patch('/:id/status', async (c) => {
  const { id } = c.req.param();
  const adminId = c.get('adminId') as string;

  const bodyResult = await parseBodyResult(c);
  const bv = validateBody(c, adminUpdateCommentStatusSchema, bodyResult);
  if (!bv.ok) return bv.response;

  const comment = await findCommentById(id);
  if (!comment) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Comment not found');
  }
  if (comment.deletedAt !== null) {
    return errorResponse(c, 409, 'CONFLICT', 'Cannot change status of a deleted comment');
  }

  const updated = await updateCommentStatus(id, bv.data.status, adminId);

  if (bv.data.status === 'approved' || comment.status === 'approved') {
    // Invalidate post cache whenever approved comments change
    await invalidateGroup('commentsModeration');
  }

  return successResponse(c, updated);
});

/**
 * PATCH /admin/comments/:id/content
 * Edit the content of any comment. Re-runs sanitize pipeline.
 */
adminCommentsRouter.patch('/:id/content', async (c) => {
  const { id } = c.req.param();
  const adminId = c.get('adminId') as string;

  const bodyResult = await parseBodyResult(c);
  const bv = validateBody(c, adminUpdateCommentContentSchema, bodyResult);
  if (!bv.ok) return bv.response;

  const comment = await findCommentById(id);
  if (!comment) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Comment not found');
  }
  if (comment.deletedAt !== null) {
    return errorResponse(c, 409, 'CONFLICT', 'Cannot edit a deleted comment');
  }

  const renderedContent = await renderCommentMarkdown(bv.data.content);
  const updated = await updateCommentContent(
    id,
    bv.data.content,
    renderedContent,
    adminId,
    bv.data.reason
  );

  if (comment.status === 'approved') {
    await invalidateGroup('commentsModeration');
  }

  return successResponse(c, updated);
});

/**
 * DELETE /admin/comments/:id
 * Soft-deletes a comment. Body accepts optional `{ reason }`.
 */
adminCommentsRouter.delete('/:id', async (c) => {
  const { id } = c.req.param();
  const adminId = c.get('adminId') as string;

  const body = await parseBodyOrEmpty(c);
  const bv = validateOptionalBody(c, adminSoftDeleteCommentSchema, body);
  if (!bv.ok) return bv.response;

  const comment = await findCommentById(id);
  if (!comment) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Comment not found');
  }
  if (comment.deletedAt !== null) {
    return errorResponse(c, 409, 'CONFLICT', 'Comment is already deleted');
  }

  const deleted = await softDeleteComment(id, adminId, bv.data.reason);

  if (comment.status === 'approved') {
    await invalidateGroup('commentsModeration');
  }

  return successResponse(c, deleted);
});

// ── Legacy endpoints (convenience maps to status PATCH) ────────────────────

/** POST /admin/comments/:id/approve → set status=approved */
adminCommentsRouter.post('/:id/approve', async (c) => {
  const { id } = c.req.param();
  const adminId = c.get('adminId') as string;

  const comment = await findCommentById(id);
  if (!comment) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Comment not found');
  }
  if (comment.deletedAt !== null) {
    return errorResponse(c, 409, 'CONFLICT', 'Cannot change status of a deleted comment');
  }
  if (comment.status === 'approved') {
    return errorResponse(c, 409, 'CONFLICT', 'Comment is already approved');
  }

  const updated = await updateCommentStatus(id, 'approved', adminId);
  await invalidateGroup('commentsModeration');

  return successResponse(c, updated);
});

/** POST /admin/comments/:id/reject → set status=rejected */
adminCommentsRouter.post('/:id/reject', async (c) => {
  const { id } = c.req.param();
  const adminId = c.get('adminId') as string;

  const comment = await findCommentById(id);
  if (!comment) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Comment not found');
  }
  if (comment.deletedAt !== null) {
    return errorResponse(c, 409, 'CONFLICT', 'Cannot change status of a deleted comment');
  }
  if (comment.status === 'rejected') {
    return errorResponse(c, 409, 'CONFLICT', 'Comment is already rejected');
  }

  const updated = await updateCommentStatus(id, 'rejected', adminId);

  if (comment.status === 'approved') {
    await invalidateGroup('commentsModeration');
  }

  return successResponse(c, updated);
});

export { adminCommentsRouter };
