import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, pgClient } from '../config/db';
import { getLogger } from '../config/logger';

const logger = getLogger('db', 'migrate');

/**
 * Run Drizzle migrations with a PostgreSQL advisory lock to prevent
 * race conditions if multiple instances start simultaneously.
 *
 * Gracefully skips if the migrations folder does not exist yet
 * (e.g. before `bun run db:generate` is executed in Module 2).
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = join(import.meta.dirname, '../../../../drizzle');

  if (!existsSync(migrationsFolder)) {
    logger.warn(
      'Migrations folder not found — skipping. Run `bun run db:generate` to create migrations.'
    );
    return;
  }

  logger.info('Acquiring advisory lock for migrations...');

  // pg_advisory_lock(lockId) — blocks until the lock is available
  await db.execute(sql`SELECT pg_advisory_lock(8301981)`);

  try {
    logger.info('Running migrations...');
    await migrate(db, { migrationsFolder });
    logger.info('Migrations complete.');
  } finally {
    await db.execute(sql`SELECT pg_advisory_unlock(8301981)`);
    logger.info('Advisory lock released.');
  }
}

// Allow running this file directly: bun run src/db/migrate.ts
if (import.meta.main) {
  const { setupLogger } = await import('../config/logger');
  await setupLogger();
  await runMigrations();
  await pgClient.end();
  process.exit(0);
}
