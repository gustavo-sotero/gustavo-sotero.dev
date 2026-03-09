import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../config/db';
import { redis } from '../../config/redis';
import { errorResponse, successResponse } from '../../lib/response';
import type { AppEnv } from '../../types/index';

const health = new Hono<AppEnv>();

/**
 * GET /health — Liveness probe.
 * Returns 200 if the process is alive.
 * No external checks — only confirms the process is running.
 */
health.get('/health', (c) => {
  return successResponse(c, {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

/**
 * GET /ready — Readiness probe.
 * Checks both PostgreSQL and Redis connectivity.
 * Returns 200 if both are available, 503 otherwise.
 */
health.get('/ready', async (c) => {
  const results = await Promise.allSettled([db.execute(sql`SELECT 1`), redis.ping()]);

  const dbOk = results[0]?.status === 'fulfilled';
  const redisOk = results[1]?.status === 'fulfilled';

  if (!dbOk || !redisOk) {
    return errorResponse(
      c,
      503,
      'SERVICE_UNAVAILABLE',
      'One or more dependencies are unavailable',
      [
        ...(dbOk ? [] : [{ field: 'db', message: 'PostgreSQL is unavailable' }]),
        ...(redisOk ? [] : [{ field: 'redis', message: 'Redis is unavailable' }]),
      ]
    );
  }

  return successResponse(c, {
    db: 'ok',
    redis: 'ok',
  });
});

export { health as healthRouter };
