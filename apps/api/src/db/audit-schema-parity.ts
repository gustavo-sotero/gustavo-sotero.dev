/**
 * Schema parity audit script.
 *
 * Verifies that the database connected via DATABASE_URL contains the
 * critical schema objects expected by the current application code.
 *
 * Run after migrations to confirm the schema is in the expected state.
 * Exits with code 1 when any required object is missing so it can be
 * used in CI to catch missing-migration-artifact regressions.
 *
 * Usage:
 *   Local: bun run --env-file .env apps/api/src/db/audit-schema-parity.ts
 *   CI/hermetic: bun run --no-env-file apps/api/src/db/audit-schema-parity.ts
 *   In hermetic mode, inject DATABASE_URL (and optionally NODE_ENV=test)
 *   through the calling shell or workflow step.
 */

import { pgClient } from '../config/db';
import { verifyRequiredSchema } from './verify-schema';

async function main() {
  console.log('Checking schema parity...\n');

  const result = await verifyRequiredSchema();

  if (result.ok) {
    console.log('✅ Schema parity OK — all required objects are present.');
    await pgClient.end();
    process.exit(0);
  }

  console.error('❌ Schema parity FAILED — the following objects are missing:\n');
  for (const item of result.missing) {
    console.error(`  • ${item}`);
  }
  console.error(
    '\nRun migrations first: bun run db:migrate\n' +
      "If the issue persists, review '__drizzle_migrations' and re-run the migration against the target database."
  );

  await pgClient.end();
  process.exit(1);
}

if (import.meta.main) {
  const { setupLogger } = await import('../config/logger');
  await setupLogger();
  await main();
}
