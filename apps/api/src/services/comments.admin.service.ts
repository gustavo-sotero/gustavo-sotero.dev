/**
 * Service layer for admin comment moderation.
 *
 * Owns all business logic for:
 *  - listing comments with filters (status, postId, deleted)
 *  - admin-authored replies
 *  - status transitions with cache invalidation
 *  - content editing with re-render and cache invalidation
 *  - soft delete with cache invalidation
 *
 * The admin comments route is responsible only for:
 *  - HTTP request parsing and body/query validation
 *  - adminId extraction from the authenticated context
 *  - mapping service errors to HTTP responses
 */

import { comments, posts } from '@portfolio/shared/db/schema';
import type {
  AdminCommentQueryInput,
  AdminReplyCommentInput,
} from '@portfolio/shared/schemas/comments';
import { and, asc, count, eq, isNotNull, isNull, type SQL } from 'drizzle-orm';
import { db } from '../config/db';
import { env } from '../config/env';
import { invalidateGroup } from '../lib/cache';
import { DomainValidationError, NotFoundError } from '../lib/errors';
import { renderCommentMarkdown } from '../lib/markdownComment';
import { buildPaginationMeta, parsePagination } from '../lib/pagination';
import {
  findCommentById,
  softDeleteComment,
  updateCommentContent,
  updateCommentStatus,
} from '../repositories/comments.repo';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Resolves cache invalidation need: invalidate when any side of a status
 * transition involves 'approved', since those comments are part of the public
 * post detail payload.
 */
function needsCacheInvalidation(oldStatus: string, newStatus?: string): boolean {
  return oldStatus === 'approved' || newStatus === 'approved';
}

// ── List ──────────────────────────────────────────────────────────────────────

export interface AdminCommentRow {
  id: string;
  postId: number;
  postTitle: string | null;
  parentCommentId: string | null;
  authorName: string;
  authorEmail: string;
  authorRole: 'guest' | 'admin';
  content: string;
  renderedContent: string;
  status: 'pending' | 'approved' | 'rejected';
  ipHash: string | null;
  createdAt: Date;
  moderatedAt: Date | null;
  moderatedBy: string | null;
  editedAt: Date | null;
  editedBy: string | null;
  editReason: string | null;
  deletedAt: Date | null;
  deletedBy: string | null;
  deleteReason: string | null;
}

/**
 * List comments for admin moderation with pagination and optional filters.
 */
export async function listAdminComments(params: AdminCommentQueryInput) {
  const { page: pageRaw, perPage: perPageRaw, status, deleted, postId } = params;
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

  return { data: rows, meta };
}

// ── Reply ─────────────────────────────────────────────────────────────────────

/**
 * Create an admin-authored reply to an existing comment.
 * Automatically approved — no moderation round-trip needed.
 *
 * @throws {NotFoundError}         when the parent comment or post does not exist
 * @throws {DomainValidationError} when the parent belongs to a different post or is deleted
 */
export async function createAdminReply(payload: AdminReplyCommentInput, adminId: string) {
  const parent = await findCommentById(payload.parentCommentId);
  if (!parent) {
    throw new NotFoundError('Parent comment not found');
  }
  if (parent.postId !== payload.postId) {
    throw new DomainValidationError('Parent comment belongs to a different post');
  }
  if (parent.deletedAt !== null) {
    throw new DomainValidationError('Cannot reply to a deleted comment');
  }

  const [post] = await db
    .select({ id: posts.id })
    .from(posts)
    .where(and(eq(posts.id, payload.postId), isNull(posts.deletedAt)))
    .limit(1);

  if (!post) {
    throw new NotFoundError('Post not found');
  }

  const renderedContent = await renderCommentMarkdown(payload.content);

  const [newComment] = await db
    .insert(comments)
    .values({
      postId: payload.postId,
      parentCommentId: payload.parentCommentId,
      authorName: env.ADMIN_DISPLAY_NAME,
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

  return newComment;
}

// ── Status ────────────────────────────────────────────────────────────────────

/**
 * Transition a comment's moderation status.
 *
 * @throws {NotFoundError}         when the comment does not exist
 * @throws {DomainValidationError} when the comment is soft-deleted
 */
export async function moderateCommentStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected',
  adminId: string
) {
  const comment = await findCommentById(id);
  if (!comment) {
    throw new NotFoundError('Comment not found');
  }
  if (comment.deletedAt !== null) {
    throw new DomainValidationError('Cannot change status of a deleted comment');
  }

  const updated = await updateCommentStatus(id, status, adminId);

  if (needsCacheInvalidation(comment.status, status)) {
    await invalidateGroup('commentsModeration');
  }

  return updated;
}

// ── Content ───────────────────────────────────────────────────────────────────

/**
 * Edit a comment's content (re-renders markdown). Records edit audit metadata.
 *
 * @throws {NotFoundError}         when the comment does not exist
 * @throws {DomainValidationError} when the comment is soft-deleted
 */
export async function editCommentContent(
  id: string,
  content: string,
  reason: string | undefined,
  adminId: string
) {
  const comment = await findCommentById(id);
  if (!comment) {
    throw new NotFoundError('Comment not found');
  }
  if (comment.deletedAt !== null) {
    throw new DomainValidationError('Cannot edit a deleted comment');
  }

  const renderedContent = await renderCommentMarkdown(content);
  const updated = await updateCommentContent(id, content, renderedContent, adminId, reason);

  if (comment.status === 'approved') {
    await invalidateGroup('commentsModeration');
  }

  return updated;
}

// ── Delete ────────────────────────────────────────────────────────────────────

/**
 * Soft-delete a comment. Records audit metadata.
 *
 * @throws {NotFoundError}  when the comment does not exist
 * @throws {DomainValidationError} when the comment is already deleted
 */
export async function removeComment(id: string, reason: string | undefined, adminId: string) {
  const comment = await findCommentById(id);
  if (!comment) {
    throw new NotFoundError('Comment not found');
  }
  if (comment.deletedAt !== null) {
    throw new DomainValidationError('Comment is already deleted');
  }

  const deleted = await softDeleteComment(id, adminId, reason);

  if (comment.status === 'approved') {
    await invalidateGroup('commentsModeration');
  }

  return deleted;
}

// ── Legacy convenience helpers ────────────────────────────────────────────────

/**
 * Approve a comment (legacy endpoint convenience).
 *
 * @throws {NotFoundError}         when the comment does not exist
 * @throws {DomainValidationError} when the comment is deleted or already approved
 */
export async function approveComment(id: string, adminId: string) {
  const comment = await findCommentById(id);
  if (!comment) {
    throw new NotFoundError('Comment not found');
  }
  if (comment.deletedAt !== null) {
    throw new DomainValidationError('Cannot change status of a deleted comment');
  }
  if (comment.status === 'approved') {
    throw new DomainValidationError('Comment is already approved');
  }

  const updated = await updateCommentStatus(id, 'approved', adminId);
  await invalidateGroup('commentsModeration');

  return updated;
}

/**
 * Reject a comment (legacy endpoint convenience).
 *
 * @throws {NotFoundError}         when the comment does not exist
 * @throws {DomainValidationError} when the comment is deleted or already rejected
 */
export async function rejectComment(id: string, adminId: string) {
  const comment = await findCommentById(id);
  if (!comment) {
    throw new NotFoundError('Comment not found');
  }
  if (comment.deletedAt !== null) {
    throw new DomainValidationError('Cannot change status of a deleted comment');
  }
  if (comment.status === 'rejected') {
    throw new DomainValidationError('Comment is already rejected');
  }

  const updated = await updateCommentStatus(id, 'rejected', adminId);

  if (comment.status === 'approved') {
    await invalidateGroup('commentsModeration');
  }

  return updated;
}
