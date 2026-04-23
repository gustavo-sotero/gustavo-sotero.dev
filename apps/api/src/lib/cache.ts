/**
 * Redis-backed cache utilities.
 *
 * Provides a `cached()` helper that wraps any async fetcher with read-through
 * caching, corrupt-entry protection, and a lightweight anti-stampede lock.
 *
 * Anti-stampede strategy: on cache miss, a short-lived Redis NX lock ensures
 * only one request computes the value while others wait briefly and retry from
 * cache, preventing thundering-herd on hot keys with expensive fetchers.
 */

import { getLogger } from '../config/logger';
import { redis } from '../config/redis';

const logger = getLogger('cache');

export const CACHE_INVALIDATION_GROUPS = {
  postsContent: ['posts:*', 'tags:*', 'feed:*', 'sitemap:*', 'developer:profile'],
  projectsContent: ['projects:*', 'tags:*', 'feed:*', 'sitemap:*', 'developer:profile'],
  skillsContent: ['skills:*', 'projects:*', 'experience:*', 'developer:profile'],
  tagsContent: ['tags:*', 'posts:*', 'projects:*', 'developer:profile'],
  postTagsSync: ['posts:*', 'tags:*'],
  projectTagsSync: ['projects:*', 'tags:*'],
  commentsModeration: ['posts:slug:*'],
  experienceContent: ['experience:*', 'developer:profile'],
  educationContent: ['education:*', 'developer:profile'],
} as const;

export type CacheInvalidationGroup = keyof typeof CACHE_INVALIDATION_GROUPS;

/** TTL for the anti-stampede lock key (seconds). Must exceed the slowest fetcher. */
const LOCK_TTL_SECONDS = 30;
/** How long a waiting request sleeps before retrying the cache after a lock miss (ms). */
const LOCK_RETRY_DELAY_MS = 75;

async function deleteKeyBestEffort(key: string, stage: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn('Cache key deletion failed', {
      key,
      stage,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Read-through cache with corrupt-entry guard and anti-stampede lock.
 *
 * Behaviour:
 *  1. Cache HIT  → return parsed value (deletes key and falls through on JSON error).
 *  2. Cache MISS → try to acquire a short-lived NX lock.
 *     a. Lock acquired → call fetcher, store result, release lock, return data.
 *     b. Lock not acquired (another request is computing) → wait briefly and
 *        retry the cache once; fall through to fetcher if still missing.
 *
 * @param key        - Redis key
 * @param ttlSeconds - Cache TTL in seconds
 * @param fetcher    - Async function to call on cache miss
 */
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  // ── 1. Try cache hit ──────────────────────────────────────────────────────
  const hit = await redis.get(key);
  if (hit !== null) {
    try {
      logger.debug('Cache hit', { key });
      return JSON.parse(hit) as T;
    } catch {
      // Corrupted cache entry — evict so the next request re-populates it.
      logger.warn('Cache entry corrupted, evicting', { key, stage: 'initial-hit' });
      await deleteKeyBestEffort(key, 'initial-hit-evict');
      // Fall through to fetcher
    }
  } else {
    logger.debug('Cache miss', { key });
  }

  // ── 2. Anti-stampede lock ─────────────────────────────────────────────────
  const lockKey = `lock:${key}`;
  const lockAcquired = await redis.set(lockKey, '1', 'EX', LOCK_TTL_SECONDS, 'NX');

  if (!lockAcquired) {
    logger.debug('Cache lock busy, waiting before retry', { key, lockKey });
    // Another request is computing — wait and retry from cache once.
    await new Promise<void>((resolve) => setTimeout(resolve, LOCK_RETRY_DELAY_MS));

    const retryHit = await redis.get(key);
    if (retryHit !== null) {
      try {
        logger.debug('Cache retry hit', { key });
        return JSON.parse(retryHit) as T;
      } catch {
        logger.warn('Cache retry entry corrupted, evicting', { key, stage: 'retry-hit' });
        await deleteKeyBestEffort(key, 'retry-hit-evict');
      }
    }
    // Still missing — fall through to fetcher (avoids indefinite stall)
    logger.debug('Cache retry miss, falling back to fetcher', { key });
  }

  // ── 3. Fetch, store, release lock ─────────────────────────────────────────
  try {
    const data = await fetcher();
    await redis.set(key, JSON.stringify(data), 'EX', ttlSeconds);
    logger.debug('Cache populated', { key, ttl: ttlSeconds });
    return data;
  } finally {
    if (lockAcquired) {
      await deleteKeyBestEffort(lockKey, 'lock-release');
    }
  }
}

/**
 * Delete all Redis keys matching a glob pattern.
 *
 * Uses SCAN (paginated, non-blocking) instead of KEYS to avoid blocking
 * Redis in production environments with many keys.
 *
 * **Scale note:** SCAN + DEL is safe and non-blocking for the current dataset
 * size (expected < tens of thousands of cache keys). If key count grows to the
 * point where SCAN latency becomes measurable (e.g. > 100 ms per invalidation),
 * consider migrating to a namespace versioning strategy: store a generation
 * counter per cache group in Redis and embed it in all cache keys, then
 * invalidate by incrementing the counter rather than scanning and deleting.
 *
 * @param pattern - Glob pattern, e.g. `posts:*`
 * This is a best-effort operation: if Redis is unavailable the error is logged
 * as a warning and the function resolves without throwing. Callers should not
 * treat cache invalidation failures as write failures — the mutation is already
 * committed and stale data will be served until the TTL expires.
 *
 * @param pattern - Glob pattern, e.g. `posts:*`
 */
export async function invalidatePattern(pattern: string): Promise<void> {
  try {
    let cursor = '0';

    do {
      const [nextCursor, keys] = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = nextCursor;

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');
  } catch (err) {
    logger.warn('Cache invalidation failed — stale data may be served until TTL', {
      pattern,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Invalidate a predefined cache group in best-effort mode.
 */
export async function invalidateGroup(group: CacheInvalidationGroup): Promise<void> {
  const patterns = CACHE_INVALIDATION_GROUPS[group];
  await Promise.all(patterns.map((pattern) => invalidatePattern(pattern)));
}

/**
 * Delete a single Redis key.
 *
 * Best-effort: logs a warning on failure instead of throwing.
 */
export async function invalidateKey(key: string): Promise<void> {
  try {
    await redis.del(key);
  } catch (err) {
    logger.warn('Cache key deletion failed', {
      key,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
