/**
 * Service layer for public comment submission.
 *
 * Encapsulates all domain logic for creating a comment:
 *   - post existence verification
 *   - parent comment validation
 *   - per-email anti-spam cooldown check and reservation
 *   - IP hashing
 *   - markdown rendering
 *   - comment persistence
 *   - async Telegram notification dispatch
 *
 * The public comments route is responsible only for:
 *   - HTTP request parsing
 *   - Schema validation
 *   - Turnstile verification (browser token, HTTP-level concern)
 *   - IP extraction from request context
 *   - Mapping typed service errors to HTTP responses
 */

import { env } from '../config/env';
import { DomainValidationError, NotFoundError, RateLimitedError } from '../lib/errors';
import { hashIp } from '../lib/hash';
import { renderCommentMarkdown } from '../lib/markdownComment';
import { enqueueTelegramNotification } from '../lib/queues';
import { isCommentEmailInCooldown, setCommentEmailCooldown } from '../middleware/rateLimit';
import {
  createComment,
  findCommentById,
  findPaginatedApprovedCommentsByPostId,
} from '../repositories/comments.repo';
import { findPostBySlug, findPublicPostById } from '../repositories/posts.repo';

export interface SubmitCommentInput {
  postId: number;
  parentCommentId?: string;
  authorName: string;
  authorEmail: string;
  content: string;
  /** Raw client IP — will be hashed internally. */
  ip: string;
  requestId?: string;
}

/**
 * Submit a public comment for moderation.
 *
 * @throws {RateLimitedError}       when the author email is in anti-spam cooldown
 * @throws {NotFoundError}          when the target post or parent comment is not found
 * @throws {DomainValidationError}  when the parent comment belongs to a different post
 *                                  or has been soft-deleted
 */
export async function submitComment(input: SubmitCommentInput): Promise<void> {
  const { postId, parentCommentId, authorName, authorEmail, content, ip } = input;

  // ── 1. Anti-spam cooldown check ──────────────────────────────────────────
  if (await isCommentEmailInCooldown(authorEmail)) {
    throw new RateLimitedError('Wait before commenting again');
  }

  // ── 2. Verify the target post exists and is publicly visible ─────────────
  const post = await findPublicPostById(postId);
  if (!post) {
    throw new NotFoundError('Post not found');
  }

  // ── 3. Validate parent comment when replying ─────────────────────────────
  if (parentCommentId !== undefined) {
    const parent = await findCommentById(parentCommentId);
    if (!parent) {
      throw new NotFoundError('Parent comment not found');
    }
    if (parent.postId !== postId) {
      throw new DomainValidationError('Parent comment belongs to a different post');
    }
    if (parent.deletedAt !== null) {
      throw new DomainValidationError('Cannot reply to a deleted comment');
    }
  }

  // ── 4. Prepare content ───────────────────────────────────────────────────
  const ipHash = await hashIp(ip, env.IP_HASH_SALT);
  const renderedContent = await renderCommentMarkdown(content);

  // ── 5. Reserve anti-spam cooldown BEFORE inserting ───────────────────────
  // Reserving before insert ensures that rapid re-submissions during the
  // insert window are blocked even if the first insert is still in-flight.
  // A non-fatal error here does NOT block the comment — the per-IP rate
  // limiter already provides a safety net at the HTTP layer.
  await setCommentEmailCooldown(authorEmail, 300);

  // ── 6. Persist comment ───────────────────────────────────────────────────
  await createComment({
    postId,
    parentCommentId: parentCommentId ?? null,
    authorName,
    authorEmail,
    authorRole: 'guest',
    content,
    renderedContent,
    status: 'pending',
    ipHash,
  });

  // ── 7. Fire-and-forget Telegram notification ─────────────────────────────
  // Failures in the queue layer must never block the 201 response.
  void enqueueTelegramNotification({
    type: 'comment',
    postTitle: post.title,
    authorName,
    contentPreview: content.slice(0, 200),
  });
}

/**
 * Fetch a paginated page of approved comments for a published post by slug.
 * Returns `null` when the post slug is not found or not publicly visible.
 */
export async function getPostComments(
  slug: string,
  page: number,
  perPage: number
): Promise<ReturnType<typeof findPaginatedApprovedCommentsByPostId> | null> {
  const post = await findPostBySlug(slug, false);
  if (!post) return null;
  return findPaginatedApprovedCommentsByPostId(post.id, page, perPage);
}
