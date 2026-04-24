import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const drizzleDir = join(import.meta.dirname, '../../../../drizzle');
const journalPath = join(drizzleDir, 'meta/_journal.json');
const metaDir = join(drizzleDir, 'meta');

type MigrationJournal = {
  entries: Array<{
    idx: number;
    tag: string;
  }>;
};

function readJournal(): MigrationJournal {
  return JSON.parse(readFileSync(journalPath, 'utf8')) as MigrationJournal;
}

describe('migration manifest', () => {
  it('keeps journal entries unique and aligned with SQL files and snapshots', () => {
    const journal = readJournal();
    const tags = journal.entries.map((entry) => entry.tag);

    expect(new Set(tags).size).toBe(tags.length);

    for (const entry of journal.entries) {
      const snapshotName = `${String(entry.idx).padStart(4, '0')}_snapshot.json`;

      expect(existsSync(join(metaDir, snapshotName))).toBe(true);
      const tag = entry.tag;
      expect(existsSync(join(drizzleDir, `${tag}.sql`))).toBe(true);
    }
  });

  it('creates the skills catalog in exactly one migration', () => {
    const journal = readJournal();

    const skillBootstrapEntries = journal.entries.filter((entry) => {
      const sql = readFileSync(join(drizzleDir, `${entry.tag}.sql`), 'utf8');
      return sql.includes('CREATE TABLE "skills"');
    });

    expect(skillBootstrapEntries).toHaveLength(1);
    expect(skillBootstrapEntries[0]?.tag).toBe('0005_add_skills');
  });

  it('keeps a forward repair migration for drifted skills catalogs', () => {
    const repairSql = readFileSync(join(drizzleDir, '0007_repair_skills_catalog.sql'), 'utf8');

    expect(repairSql).toContain('CREATE TYPE "public"."skill_category" AS ENUM');
    expect(repairSql).toContain('CREATE TABLE IF NOT EXISTS "skills"');
    expect(repairSql).toContain('CREATE TABLE IF NOT EXISTS "project_skills"');
    expect(repairSql).toContain('CREATE TABLE IF NOT EXISTS "experience_skills"');
    expect(repairSql).toContain('CREATE INDEX IF NOT EXISTS "skills_category_idx"');
  });
});
