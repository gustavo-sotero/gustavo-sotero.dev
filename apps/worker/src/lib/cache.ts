import Redis from 'ioredis';
import { env } from '../config/env';
import { getLogger } from '../config/logger';

const redis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
});

const logger = getLogger('lib', 'cache');

/**
 * Delete all keys matching a glob pattern using SCAN (non-blocking).
 *
 * Best-effort: if Redis is unavailable, logs a warning and resolves without
 * throwing. Cache invalidation is non-transactional — the durable state change
 * (DB update) is already committed before this is called. A failure here means
 * stale data is served until the TTL expires, which is acceptable and should
 * not trigger a job retry.
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

export async function closeCacheRedis(): Promise<void> {
  await redis.quit().catch(async () => {
    redis.disconnect();
  });
}
