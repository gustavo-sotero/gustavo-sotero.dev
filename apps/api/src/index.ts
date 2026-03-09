import { getLogger, setupLogger } from './config/logger';

// ── Bootstrap ─────────────────────────────────────────────────────────────────
// We must configure the logger before importing other modules that use it,
// since those imports execute top-level code.
await setupLogger();

import { app } from './app';
import { pgClient } from './config/db';
import { env } from './config/env';
import { bullRedis, redis } from './config/redis';
import { runMigrations } from './db/migrate';

const logger = getLogger();

// ── Run Migrations ────────────────────────────────────────────────────────────
await runMigrations();

// ── Start Server ──────────────────────────────────────────────────────────────
const server = Bun.serve({
  fetch: app.fetch,
  port: env.PORT,
});

logger.info('Server started', {
  port: env.PORT,
  env: env.NODE_ENV,
  pid: process.pid,
});

// ── Graceful Shutdown ─────────────────────────────────────────────────────────
async function shutdown(signal: string): Promise<void> {
  logger.info('Received shutdown signal — closing gracefully', { signal });

  try {
    // Stop accepting new requests
    server.stop();
    logger.info('HTTP server stopped');

    // Close database pool
    await pgClient.end();
    logger.info('PostgreSQL connection closed');

    // Close Redis connections
    await redis.quit();
    await bullRedis.quit();
    logger.info('Redis connections closed');

    logger.info('Shutdown complete');
    process.exit(0);
  } catch (err) {
    logger.error('Error during shutdown', { error: (err as Error).message });
    process.exit(1);
  }
}

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
