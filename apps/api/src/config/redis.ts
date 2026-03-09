import Redis from 'ioredis';
import { env } from './env';
import { getLogger } from './logger';

const logger = getLogger('redis');

// Standard Redis connection — used for cache and rate limiting
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableAutoPipelining: true,
  retryStrategy(times) {
    if (times > 10) return null; // Give up after 10 retries
    return Math.min(times * 200, 2000);
  },
});

// Dedicated BullMQ Redis connection
// BullMQ REQUIRES maxRetriesPerRequest: null — otherwise it panics on blocked commands
export const bullRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(times) {
    if (times > 20) return null;
    return Math.min(times * 100, 3000);
  },
});

redis.on('error', (err) => {
  logger.error('[Redis] Connection error: {message}', { message: err.message });
});

bullRedis.on('error', (err) => {
  logger.error('[BullMQ Redis] Connection error: {message}', { message: err.message });
});
