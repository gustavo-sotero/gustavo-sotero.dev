import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { db, pgClient } from '../config/db';
import { getLogger } from '../config/logger';
import { verifyRequiredSchema } from './verify-schema';

const logger = getLogger('db', 'migrate');

/**
 * Run Drizzle migrations with a PostgreSQL advisory lock to prevent
 * race conditions if multiple instances start simultaneously.
 *
 * A missing migrations folder is fatal in production. Set
 * ALLOW_MISSING_MIGRATIONS=true to skip (development only — never in
 * deployed images, which must always contain the drizzle directory).
 *
 * After migrations complete, runs a schema-parity check to catch drift
 * between the migration history and the actual schema state. Startup is
 * blocked if required objects are absent.
 */
export async function runMigrations(): Promise<void> {
  const migrationsFolder = join(import.meta.dirname, '../../../../drizzle');

  if (!existsSync(migrationsFolder)) {
    if (process.env.ALLOW_MISSING_MIGRATIONS === 'true') {
      logger.warn(
        'Migrations folder not found — skipping (ALLOW_MISSING_MIGRATIONS=true). ' +
          'Run `bun run db:generate` to create migrations.'
      );
      return;
    }

    throw new Error(
      'Migrations folder not found at expected path. ' +
        'The runtime image must contain the drizzle directory. ' +
        'Set ALLOW_MISSING_MIGRATIONS=true to skip (development only).'
    );
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

  // Verify required schema objects exist after migrations complete.
  // A missing table or column after migration indicates a drift condition
  // that must block startup rather than serve broken traffic.
  logger.info('Verifying required schema objects...');
  const parity = await verifyRequiredSchema();
  if (!parity.ok) {
    throw new Error(
      `Schema parity check failed after migrations. Missing: ${parity.missing.join(', ')}. ` +
        "Inspect '__drizzle_migrations' and re-run migrations against the target database."
    );
  }
  logger.info('Schema parity OK.');
}

// Allow running this file directly. Local use should pass an explicit env file
// (for example via `bun run db:migrate` from the repo root); CI should inject
// DATABASE_URL and use `bun --no-env-file run apps/api/src/db/migrate.ts`.
if (import.meta.main) {
  const { setupLogger } = await import('../config/logger');
  await setupLogger();
  await runMigrations();
  await pgClient.end();
  process.exit(0);
}
