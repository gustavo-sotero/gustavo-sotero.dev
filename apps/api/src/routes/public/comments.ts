import { createCommentSchema } from '@portfolio/shared/schemas/comments';
import { Hono } from 'hono';
import { DomainValidationError, NotFoundError, RateLimitedError } from '../../lib/errors';
import { errorResponse, successResponse } from '../../lib/response';
import { validateTurnstile } from '../../lib/turnstile';
import { parseAndValidateBody } from '../../lib/validate';
import { createRateLimit, getClientIp } from '../../middleware/rateLimit';
import { submitComment } from '../../services/comments.service';
import type { AppEnv } from '../../types/index';

const commentsRouter = new Hono<AppEnv>();

const commentsRateLimit = createRateLimit({
  maxRequests: 5,
  windowMs: 60_000,
  keyPrefix: 'rl:comments',
});

commentsRouter.post('/', commentsRateLimit, async (c) => {
  const bv = await parseAndValidateBody(c, createCommentSchema);
  if (!bv.ok) return bv.response;

  const payload = bv.data;
  const ip = getClientIp(c);

  // Turnstile is an HTTP-level browser token check — stays in the route.
  const turnstileValid = await validateTurnstile(payload.turnstileToken, ip, {
    requestId: c.get('requestId'),
  });
  if (!turnstileValid) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Security verification failed');
  }

  try {
    await submitComment({
      postId: payload.postId,
      parentCommentId: payload.parentCommentId,
      authorName: payload.authorName,
      authorEmail: payload.authorEmail,
      content: payload.content,
      ip,
      requestId: c.get('requestId'),
    });
  } catch (err) {
    if (err instanceof RateLimitedError) {
      return errorResponse(c, 429, 'RATE_LIMITED', err.message);
    }
    if (err instanceof NotFoundError) {
      return errorResponse(c, 404, 'NOT_FOUND', err.message);
    }
    if (err instanceof DomainValidationError) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', err.message);
    }
    throw err;
  }

  return successResponse(c, { message: 'Comment sent for moderation' }, 201);
});

export { commentsRouter };
