import { sql } from 'drizzle-orm';
import { Hono } from 'hono';
import { db } from '../../config/db';
import { redis } from '../../config/redis';
import { formatSchemaParityIssues, verifyRequiredSchema } from '../../db/verify-schema';
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
 * Checks PostgreSQL connectivity, Redis connectivity, and required schema
 * object presence. Returns 200 only when all three are healthy.
 * Returns 503 with field-level details identifying which dependency failed.
 */
health.get('/ready', async (c) => {
  const [dbResult, redisResult, schemaResult] = await Promise.allSettled([
    db.execute(sql`SELECT 1`),
    redis.ping(),
    verifyRequiredSchema(),
  ]);

  const dbOk = dbResult.status === 'fulfilled';
  const redisOk = redisResult.status === 'fulfilled';
  // Schema check is only meaningful when the DB connection itself is healthy.
  const schemaOk =
    dbOk &&
    schemaResult.status === 'fulfilled' &&
    (schemaResult.value as Awaited<ReturnType<typeof verifyRequiredSchema>>).ok;

  if (!dbOk || !redisOk || !schemaOk) {
    const details: Array<{ field: string; message: string }> = [];

    if (!dbOk) {
      details.push({ field: 'db', message: 'PostgreSQL is unavailable' });
    }
    if (!redisOk) {
      details.push({ field: 'redis', message: 'Redis is unavailable' });
    }
    if (dbOk && !schemaOk) {
      const issues =
        schemaResult.status === 'fulfilled'
          ? formatSchemaParityIssues(
              schemaResult.value as Awaited<ReturnType<typeof verifyRequiredSchema>>
            )
          : ['unknown (schema check threw)'];
      details.push({
        field: 'db-schema',
        message: `Schema parity issues: ${issues.join(', ')}`,
      });
    }

    return errorResponse(
      c,
      503,
      'SERVICE_UNAVAILABLE',
      'One or more dependencies are unavailable',
      details
    );
  }

  return successResponse(c, {
    db: 'ok',
    redis: 'ok',
    schema: 'ok',
  });
});

export { health as healthRouter };
