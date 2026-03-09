import type { Context, MiddlewareHandler, Next } from 'hono';
import { getCookie } from 'hono/cookie';
import { verify } from 'hono/jwt';
import { env } from '../config/env';
import { getLogger } from '../config/logger';
import { errorResponse } from '../lib/response';
import type { AppEnv } from '../types/index';

const logger = getLogger('auth');

/**
 * Admin authentication middleware.
 *
 * Reads the `admin_token` HTTP-only cookie, verifies the JWT signature,
 * and validates that the `sub` claim matches `ADMIN_GITHUB_ID`.
 *
 * Sets `c.var.adminId` on success.
 * Returns 401 for missing/invalid/expired tokens, 403 for unknown admin IDs.
 */
export const authAdmin: MiddlewareHandler<AppEnv> = async (
  c: Context<AppEnv>,
  next: Next
): Promise<void> => {
  const token = getCookie(c, 'admin_token');

  if (!token) {
    c.res = errorResponse(c, 401, 'UNAUTHORIZED', 'Authentication required');
    return;
  }

  try {
    const payload = await verify(token, env.JWT_SECRET, 'HS256');

    // payload.sub must match the configured admin GitHub ID
    if (!payload.sub || String(payload.sub) !== String(env.ADMIN_GITHUB_ID)) {
      c.res = errorResponse(c, 403, 'FORBIDDEN', 'User not authorized');
      return;
    }

    // Inject admin identity into context for downstream handlers
    c.set('adminId', String(payload.sub));
    c.set('jwtPayload', {
      sub: String(payload.sub),
      role: String(payload.role ?? 'admin'),
      exp: Number(payload.exp),
      iat: Number(payload.iat ?? 0),
    });

    await next();
  } catch (err) {
    logger.warn('JWT verification failed', {
      error: err instanceof Error ? err.message : String(err),
    });
    c.res = errorResponse(c, 401, 'UNAUTHORIZED', 'Invalid or expired session');
    return;
  }
};
