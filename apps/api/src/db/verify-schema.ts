/**
 * Schema parity verifier.
 *
 * Checks that the critical database objects required by the current
 * application code exist in the connected PostgreSQL database.
 * Used at startup (after migrations) and in the readiness probe.
 *
 * This is a targeted check — it is not a full schema diff. It verifies
 * the exact objects that have been historically absent in drifted
 * environments: the `experience_tags` pivot table and the
 * `tags.is_highlighted` column.
 */

import { sql } from 'drizzle-orm';
import { db } from '../config/db';

export interface SchemaParity {
  ok: boolean;
  missing: string[];
}

/**
 * Returns `{ ok: true, missing: [] }` when all required schema objects exist,
 * or `{ ok: false, missing: [...] }` listing every missing object.
 *
 * Safe to call from the readiness probe — uses system-catalog queries that
 * are cheap and do not acquire user-visible locks.
 */
export async function verifyRequiredSchema(): Promise<SchemaParity> {
  const missing: string[] = [];

  // 1. Verify experience_tags table exists
  const [tableRow] = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
        AND tablename  = 'experience_tags'
    ) AS "exists"
  `);

  if (!tableRow?.exists) {
    missing.push('table:experience_tags');
  }

  // 2. Verify tags.is_highlighted column exists
  const [colRow] = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name   = 'tags'
        AND column_name  = 'is_highlighted'
    ) AS "exists"
  `);

  if (!colRow?.exists) {
    missing.push('column:tags.is_highlighted');
  }

  return { ok: missing.length === 0, missing };
}
