import { timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { errorResponse } from '../lib/response';
import type { AppEnv } from '../types/index';

/**
 * CSRF Double Submit Cookie protection middleware.
 *
 * Requires the `csrf_token` cookie value to match the `X-CSRF-Token` request header.
 * Compare is done in constant time to mitigate timing attacks.
 *
 * Apply on all admin mutating routes: POST, PATCH, DELETE.
 * Admin GET routes do not require CSRF protection.
 */
export const csrfProtection: MiddlewareHandler<AppEnv> = async (
  c: Context<AppEnv>,
  next: Next
): Promise<void> => {
  const cookieToken = getCookie(c, 'csrf_token');
  const headerToken = c.req.header('x-csrf-token');

  // Both must be present
  if (!cookieToken || !headerToken) {
    c.res = errorResponse(c, 403, 'FORBIDDEN', 'Invalid CSRF token');
    return;
  }

  const cookieBuffer = Buffer.from(cookieToken);
  const headerBuffer = Buffer.from(headerToken);

  // Must be the same byte length before running timingSafeEqual (different-length buffers throw)
  if (cookieBuffer.length !== headerBuffer.length) {
    c.res = errorResponse(c, 403, 'FORBIDDEN', 'Invalid CSRF token');
    return;
  }

  if (!timingSafeEqual(cookieBuffer, headerBuffer)) {
    c.res = errorResponse(c, 403, 'FORBIDDEN', 'Invalid CSRF token');
    return;
  }

  await next();
};
