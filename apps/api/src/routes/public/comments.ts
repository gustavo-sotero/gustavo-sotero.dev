import { comments as commentsTable, posts } from '@portfolio/shared/db/schema';
import { createCommentSchema } from '@portfolio/shared/schemas/comments';
import { and, eq, isNull } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../config/db';
import { env } from '../../config/env';
import { hashIp } from '../../lib/hash';
import { renderCommentMarkdown } from '../../lib/markdownComment';
import { enqueueTelegramNotification } from '../../lib/queues';
import { parseBodyResult } from '../../lib/requestBody';
import { errorResponse, successResponse } from '../../lib/response';
import { validateTurnstile } from '../../lib/turnstile';
import {
  createRateLimit,
  getClientIp,
  isCommentEmailInCooldown,
  setCommentEmailCooldown,
} from '../../middleware/rateLimit';
import { findCommentById } from '../../repositories/comments.repo';
import type { AppEnv } from '../../types/index';

const commentsRouter = new Hono<AppEnv>();

const commentsRateLimit = createRateLimit({
  maxRequests: 5,
  windowMs: 60_000,
  keyPrefix: 'rl:comments',
});

commentsRouter.post('/', commentsRateLimit, async (c) => {
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

  const parsed = createCommentSchema.safeParse(bodyResult.data);

  if (!parsed.success) {
    const details = parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  const payload = parsed.data;

  // Validate Turnstile token before any further processing
  const ip = getClientIp(c);
  const turnstileValid = await validateTurnstile(payload.turnstileToken, ip, {
    requestId: c.get('requestId'),
  });
  if (!turnstileValid) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Security verification failed');
  }

  if (await isCommentEmailInCooldown(payload.authorEmail)) {
    return errorResponse(c, 429, 'RATE_LIMITED', 'Wait before commenting again');
  }

  const [post] = await db
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(
      and(eq(posts.id, payload.postId), eq(posts.status, 'published'), isNull(posts.deletedAt))
    )
    .limit(1);

  if (!post) {
    return errorResponse(c, 404, 'NOT_FOUND', 'Post not found');
  }

  // Validate parent comment if provided
  if (payload.parentCommentId !== undefined) {
    const parent = await findCommentById(payload.parentCommentId);
    if (!parent) {
      return errorResponse(c, 404, 'NOT_FOUND', 'Parent comment not found');
    }
    if (parent.postId !== payload.postId) {
      return errorResponse(
        c,
        400,
        'VALIDATION_ERROR',
        'Parent comment belongs to a different post'
      );
    }
    if (parent.deletedAt !== null) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', 'Cannot reply to a deleted comment');
    }
  }

  const ipHash = await hashIp(ip, env.IP_HASH_SALT);
  const renderedContent = await renderCommentMarkdown(payload.content);

  // Reserve the anti-spam cooldown BEFORE inserting so that:
  // a) a repeated submission during the cooldown window is blocked even if the
  //    first insert is in-flight; and
  // b) if the insert below fails we still have the cooldown in place (prevents
  //    rapid re-submission on transient DB errors).
  // Failing to set the cooldown is non-fatal — we log a warning but do not block
  // the comment, because the per-IP rate limiter already provides a safety net.
  await setCommentEmailCooldown(payload.authorEmail, 300);

  await db.insert(commentsTable).values({
    postId: payload.postId,
    parentCommentId: payload.parentCommentId ?? null,
    authorName: payload.authorName,
    authorEmail: payload.authorEmail,
    authorRole: 'guest',
    content: payload.content,
    renderedContent,
    status: 'pending',
    ipHash,
  });

  // Fire-and-forget: notify admin via Telegram — do not await so enqueue latency
  // never blocks the 201 response. Failures are handled inside the job queue.
  void enqueueTelegramNotification({
    type: 'comment',
    postTitle: post.title,
    authorName: payload.authorName,
    contentPreview: payload.content.slice(0, 200),
  });

  return successResponse(c, { message: 'Comment sent for moderation' }, 201);
});

export { commentsRouter };
