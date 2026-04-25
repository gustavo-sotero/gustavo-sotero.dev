/**
 * Schema parity verifier.
 *
 * Checks that the critical database objects required by the current
 * application code exist in the connected PostgreSQL database.
 * Used at startup (after migrations) and in the readiness probe.
 *
 * This is a targeted check — it is not a full schema diff. It verifies
 * the exact objects that define the current skills-only contract for
 * projects and experience: the skill domain tables must exist and the
 * removed legacy tag pivots must stay absent.
 */

import { sql } from 'drizzle-orm';
import { db } from '../config/db';

export interface SchemaParity {
  ok: boolean;
  missing: string[];
  unexpected: string[];
}

async function tableExists(tableName: string): Promise<boolean> {
  const [row] = await db.execute<{ exists: boolean }>(sql`
    SELECT EXISTS (
      SELECT 1
      FROM pg_catalog.pg_tables
      WHERE schemaname = 'public'
        AND tablename  = ${tableName}
    ) AS "exists"
  `);

  return Boolean(row?.exists);
}

export function formatSchemaParityIssues(result: SchemaParity): string[] {
  return [
    ...result.missing.map((item) => `${item} (missing)`),
    ...result.unexpected.map((item) => `${item} (should be absent)`),
  ];
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
  const unexpected: string[] = [];

  const REQUIRED_TABLES = ['skills', 'project_skills', 'experience_skills'];
  const REMOVED_LEGACY_TABLES = ['project_tags', 'experience_tags'];

  for (const tableName of REQUIRED_TABLES) {
    if (!(await tableExists(tableName))) {
      missing.push(`table:${tableName}`);
    }
  }

  for (const tableName of REMOVED_LEGACY_TABLES) {
    if (await tableExists(tableName)) {
      unexpected.push(`table:${tableName}`);
    }
  }

  return { ok: missing.length === 0 && unexpected.length === 0, missing, unexpected };
}
