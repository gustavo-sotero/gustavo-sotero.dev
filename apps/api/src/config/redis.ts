import Redis from 'ioredis';
import { env } from './env';
import { getLogger } from './logger';

const logger = getLogger('redis');

function withExponentialBackoff(
  attempts: number,
  maxRetries: number,
  baseDelayMs: number,
  maxDelayMs: number,
  clientName: string
): number | null {
  if (attempts > maxRetries) {
    logger.error('[{client}] Retry budget exhausted — giving up reconnect attempts', {
      client: clientName,
      attempts,
      maxRetries,
    });
    return null;
  }

  const exponential = Math.min(maxDelayMs, baseDelayMs * 2 ** Math.min(attempts - 1, 6));
  const jitter = Math.floor(Math.random() * 120);
  const delay = exponential + jitter;

  if (attempts === 1 || attempts % 5 === 0) {
    logger.warn('[{client}] Redis reconnect scheduled', {
      client: clientName,
      attempts,
      delayMs: delay,
    });
  }

  return delay;
}

function reconnectOnError(err: Error, clientName: string): boolean {
  const message = err.message.toLowerCase();

  // Permanent auth/config issues should not trigger reconnect loops.
  if (
    message.includes('noauth') ||
    message.includes('wrongpass') ||
    message.includes('invalid password') ||
    message.includes('acl')
  ) {
    logger.error('[{client}] Redis permanent auth/config error', {
      client: clientName,
      error: err.message,
    });
    return false;
  }

  // Transient server states where command retry is safe.
  if (message.includes('read only') || message.includes('loading')) {
    logger.warn('[{client}] Redis transient server state, retrying command', {
      client: clientName,
      error: err.message,
    });
    return true;
  }

  return false;
}

function attachRedisEvents(client: Redis, clientName: string): void {
  client.on('connect', () => {
    logger.info('[{client}] TCP connection established', { client: clientName });
  });

  client.on('ready', () => {
    logger.info('[{client}] Redis connection ready', { client: clientName });
  });

  client.on('reconnecting', (delayMs: number) => {
    logger.warn('[{client}] Reconnecting to Redis', { client: clientName, delayMs });
  });

  client.on('close', () => {
    logger.warn('[{client}] Connection closed', { client: clientName });
  });

  client.on('end', () => {
    logger.error('[{client}] Connection ended', { client: clientName });
  });

  client.on('error', (err) => {
    logger.error('[{client}] Connection error: {message}', {
      client: clientName,
      message: err.message,
    });
  });
}

// Standard Redis connection — used for cache and rate limiting
export const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableAutoPipelining: true,
  retryStrategy(attempts) {
    return withExponentialBackoff(attempts, 10, 120, 2_500, 'redis');
  },
  reconnectOnError(err) {
    return reconnectOnError(err, 'redis');
  },
});

// Dedicated BullMQ Redis connection
// BullMQ REQUIRES maxRetriesPerRequest: null — otherwise it panics on blocked commands
export const bullRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,
  enableReadyCheck: false,
  retryStrategy(attempts) {
    return withExponentialBackoff(attempts, 20, 100, 3_000, 'bull-redis');
  },
  reconnectOnError(err) {
    return reconnectOnError(err, 'bull-redis');
  },
});

attachRedisEvents(redis, 'redis');
attachRedisEvents(bullRedis, 'bull-redis');
