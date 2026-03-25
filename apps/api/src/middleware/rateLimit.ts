import type { Context, MiddlewareHandler, Next } from 'hono';
import { env } from '../config/env';
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

// ── Local in-memory fallback store ────────────────────────────────────────────
// Active only when Redis is unavailable. Scoped to the current process —
// intentionally single-instance only. Disable via RATE_LIMIT_LOCAL_FALLBACK=false
// if deploying with multiple replicas to avoid inconsistent per-replica counters.

interface LocalBucket {
  timestamps: number[];
  expiresAt: number;
}

const localFallbackStore = new Map<string, LocalBucket>();
let localFallbackActive = false;

function isLocalFallbackEnabled(): boolean {
  return env.RATE_LIMIT_LOCAL_FALLBACK;
}

function pruneLocalStore(): void {
  const now = Date.now();
  for (const [key, bucket] of localFallbackStore.entries()) {
    if (bucket.expiresAt < now) {
      localFallbackStore.delete(key);
    }
  }
}

/**
 * Local sliding-window counter — more restrictive than Redis to compensate for
 * the lack of cross-instance synchronisation.
 *
 * @param key        - Rate-limit bucket key (unique per route + IP)
 * @param maxAllowed - Maximum requests in window (applied at 80% of Redis limit)
 * @param windowMs   - Window duration in milliseconds
 * @returns `true` when the request is within the limit, `false` when blocked.
 */
function checkLocalRateLimit(key: string, maxAllowed: number, windowMs: number): boolean {
  const now = Date.now();
  const windowStart = now - windowMs;

  // Drop stale buckets every ~1000 checks to keep Map bounded.
  if (Math.random() < 0.001) pruneLocalStore();

  let bucket = localFallbackStore.get(key);
  if (!bucket || bucket.expiresAt < now) {
    bucket = { timestamps: [], expiresAt: now + windowMs };
    localFallbackStore.set(key, bucket);
  }

  // Evict timestamps outside the current window
  bucket.timestamps = bucket.timestamps.filter((ts) => ts > windowStart);
  bucket.timestamps.push(now);
  bucket.expiresAt = now + windowMs;

  // Apply a more conservative cap (80% of configured limit, min 1)
  const localMax = Math.max(1, Math.floor(maxAllowed * 0.8));
  return bucket.timestamps.length <= localMax;
}

/**
 * Redis sliding-window rate limiter factory.
 *
 * Uses ZREMRANGEBYSCORE + ZADD + ZCARD + EXPIRE in a pipeline for atomicity.
 * Each unique request entry is keyed by its timestamp + random suffix.
 *
 * Falls back to a local in-memory counter when Redis is unavailable.
 * The local fallback uses a more conservative limit (80% of configured max)
 * and emits a structured log on activation/recovery to maintain observability.
 *
 * Usage:
 *   router.post('/comments', createRateLimit({ maxRequests: 5, windowMs: 60_000, keyPrefix: 'rl:comments' }), handler)
 */
export function createRateLimit(opts: RateLimitOptions): MiddlewareHandler<AppEnv> {
  const { maxRequests, windowMs, keyPrefix } = opts;

  return async (c: Context<AppEnv>, next: Next): Promise<void> => {
    const ip = getClientIp(c);
    const key = `${keyPrefix}:${ip}`;

    // ── Redis path ──────────────────────────────────────────────────────────
    try {
      const now = Date.now();
      const windowStart = now - windowMs;
      const member = `${now}:${crypto.randomUUID()}`;

      const transaction = redis
        .multi()
        .zremrangebyscore(key, 0, windowStart)
        .zadd(key, now, member)
        .zcard(key)
        .expire(key, Math.ceil(windowMs / 1000));

      const results = await transaction.exec();

      if (results) {
        const execError = results.find(([err]) => err !== null)?.[0];
        if (!execError) {
          // Successful Redis path — mark recovery if we were in fallback mode
          if (localFallbackActive) {
            localFallbackActive = false;
            logger.info('Rate limit: Redis recovered, switching back from local fallback', {
              keyPrefix,
            });
          }

          const count = Number(results[2]?.[1] ?? 0);
          if (count > maxRequests) {
            const retryAfter = Math.ceil(windowMs / 1000);
            c.header('Retry-After', String(retryAfter));
            c.res = errorResponse(
              c,
              429,
              'RATE_LIMITED',
              'Too many requests. Please try again later.'
            );
            return;
          }

          await next();
          return;
        }
      }

      // Pipeline returned null or per-command errors — fall through to local fallback
    } catch (err) {
      logger.warn('Rate limit: Redis error, activating local in-memory fallback', {
        keyPrefix,
        error: err instanceof Error ? err.message : String(err),
        localFallbackEnabled: isLocalFallbackEnabled(),
      });
    }

    // ── Local fallback path ─────────────────────────────────────────────────
    if (!isLocalFallbackEnabled()) {
      c.res = errorResponse(c, 503, 'SERVICE_UNAVAILABLE', 'Rate limit service unavailable');
      return;
    }

    if (!localFallbackActive) {
      localFallbackActive = true;
      logger.warn('Rate limit: activating local in-memory fallback — single-instance only', {
        keyPrefix,
        localStoreSize: localFallbackStore.size,
      });
    }

    const allowed = checkLocalRateLimit(key, maxRequests, windowMs);
    if (!allowed) {
      const retryAfter = Math.ceil(windowMs / 1000);
      c.header('Retry-After', String(retryAfter));
      c.res = errorResponse(c, 429, 'RATE_LIMITED', 'Too many requests. Please try again later.');
      return;
    }

    await next();
  };
}

// ── Local fallback helpers for cooldown ───────────────────────────────────────

interface CooldownEntry {
  expiresAt: number;
}

const localCooldownStore = new Map<string, CooldownEntry>();

function checkLocalCooldown(key: string): boolean {
  const entry = localCooldownStore.get(key);
  if (!entry) return false;
  if (entry.expiresAt < Date.now()) {
    localCooldownStore.delete(key);
    return false;
  }
  return true;
}

function setLocalCooldown(key: string, ttlSeconds: number): void {
  localCooldownStore.set(key, { expiresAt: Date.now() + ttlSeconds * 1000 });
}

/**
 * Enforces comment cooldown by hashed email.
 * Falls back to local in-memory store when Redis is unavailable.
 * Returns true when cooldown is active (request must be blocked), false otherwise.
 */
export async function isCommentEmailInCooldown(email: string): Promise<boolean> {
  const emailHash = await sha256(email.trim().toLowerCase());
  const key = `cooldown:comment:${emailHash}`;
  try {
    const exists = await redis.get(key);
    return exists === '1';
  } catch (err) {
    logger.warn('Comment cooldown: Redis read failed, using local fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    return checkLocalCooldown(key);
  }
}

/**
 * Starts/renews comment cooldown for the provided email.
 * Falls back to local in-memory store when Redis is unavailable.
 */
export async function setCommentEmailCooldown(email: string, cooldownSeconds = 300): Promise<void> {
  const emailHash = await sha256(email.trim().toLowerCase());
  const key = `cooldown:comment:${emailHash}`;
  try {
    await redis.set(key, '1', 'EX', cooldownSeconds);
  } catch (err) {
    logger.warn('Comment cooldown: Redis write failed, using local fallback', {
      error: err instanceof Error ? err.message : String(err),
    });
    setLocalCooldown(key, cooldownSeconds);
  }
}
