import type { Context, MiddlewareHandler, Next } from 'hono';
import { getLogger } from '../config/logger';
import { redis } from '../config/redis';
import { sha256 } from '../lib/hash';
import { getClientIp } from '../lib/ip';
import { errorResponse } from '../lib/response';
import type { AppEnv } from '../types/index';

// Re-export so existing callers (analytics middleware) keep working.
export { getClientIp };

const logger = getLogger('rate-limit');

interface RateLimitOptions {
  /** Maximum number of requests allowed within the window */
  maxRequests: number;
  /** Window duration in milliseconds */
  windowMs: number;
  /** Redis key prefix — must be unique per route to avoid interference */
  keyPrefix: string;
}

/**
 * Redis sliding-window rate limiter factory.
 *
 * Uses ZREMRANGEBYSCORE + ZADD + ZCARD + EXPIRE in a pipeline for atomicity.
 * Each unique request entry is keyed by its timestamp + random suffix.
 *
 * Usage:
 *   router.post('/comments', createRateLimit({ maxRequests: 5, windowMs: 60_000, keyPrefix: 'rl:comments' }), handler)
 */
export function createRateLimit(opts: RateLimitOptions): MiddlewareHandler<AppEnv> {
  const { maxRequests, windowMs, keyPrefix } = opts;

  return async (c: Context<AppEnv>, next: Next): Promise<void> => {
    try {
      const ip = getClientIp(c);
      const key = `${keyPrefix}:${ip}`;
      const now = Date.now();
      const windowStart = now - windowMs;
      // Unique member: timestamp + random suffix to allow multiple entries at the same ms
      const member = `${now}:${crypto.randomUUID()}`;

      const transaction = redis
        .multi()
        .zremrangebyscore(key, 0, windowStart)
        .zadd(key, now, member)
        .zcard(key)
        .expire(key, Math.ceil(windowMs / 1000));

      const results = await transaction.exec();
      if (!results) {
        c.res = errorResponse(c, 503, 'SERVICE_UNAVAILABLE', 'Rate limit service unavailable');
        return;
      }

      const execError = results.find(([err]) => err !== null)?.[0];
      if (execError) {
        c.res = errorResponse(c, 503, 'SERVICE_UNAVAILABLE', 'Rate limit service unavailable');
        return;
      }

      const count = Number(results[2]?.[1] ?? 0);

      if (count > maxRequests) {
        const retryAfter = Math.ceil(windowMs / 1000);
        c.header('Retry-After', String(retryAfter));
        c.res = errorResponse(c, 429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
        return;
      }

      await next();
    } catch (err) {
      logger.error('Rate limit Redis error', {
        error: err instanceof Error ? err.message : String(err),
        keyPrefix: opts.keyPrefix,
      });
      c.res = errorResponse(c, 503, 'SERVICE_UNAVAILABLE', 'Rate limit service unavailable');
      return;
    }
  };
}

/**
 * Enforces comment cooldown by hashed email.
 * Returns true when cooldown is active (request must be blocked), false otherwise.
 */
export async function isCommentEmailInCooldown(email: string): Promise<boolean> {
  const emailHash = await sha256(email.trim().toLowerCase());
  const key = `cooldown:comment:${emailHash}`;
  const exists = await redis.get(key);
  return exists === '1';
}

/**
 * Starts/renews comment cooldown for the provided email.
 */
export async function setCommentEmailCooldown(email: string, cooldownSeconds = 300): Promise<void> {
  const emailHash = await sha256(email.trim().toLowerCase());
  const key = `cooldown:comment:${emailHash}`;
  await redis.set(key, '1', 'EX', cooldownSeconds);
}
