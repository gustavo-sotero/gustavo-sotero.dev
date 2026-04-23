/**
 * Schema parity verifier.
 *
 * Checks that the critical database objects required by the current
 * application code exist in the connected PostgreSQL database.
 * Used at startup (after migrations) and in the readiness probe.
 *
 * This is a targeted check — it is not a full schema diff. It verifies
 * the exact objects that have been historically absent in drifted
 * environments: the `experience_tags` pivot table, the
 * `tags.is_highlighted` column, and the skill domain tables.
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

  const REQUIRED_TABLES = ['experience_tags', 'skills', 'project_skills', 'experience_skills'];

  for (const tableName of REQUIRED_TABLES) {
    const [row] = await db.execute<{ exists: boolean }>(sql`
      SELECT EXISTS (
        SELECT 1
        FROM pg_catalog.pg_tables
        WHERE schemaname = 'public'
          AND tablename  = ${tableName}
      ) AS "exists"
    `);
    if (!row?.exists) {
      missing.push(`table:${tableName}`);
    }
  }

  // Verify tags.is_highlighted column exists
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
