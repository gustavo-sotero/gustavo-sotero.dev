import { z } from 'zod';
import { databaseFields } from './env.fields';

/**
 * Minimal env parser for database access.
 *
 * Validates only DATABASE_URL so that operational DB scripts (migrations,
 * schema audits, backfills) can run in CI with a single injected variable
 * without requiring Redis, OAuth, S3, Telegram, or any other runtime secrets.
 *
 * Used by `config/db.ts`. Do not import the full `env` export from `env.ts`
 * in database-only contexts — that would re-introduce the env-boundary violation.
 */
const databaseEnvSchema = z.object(databaseFields);

const parsed = databaseEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid database environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const databaseEnv = parsed.data;
export type DatabaseEnv = typeof databaseEnv;
