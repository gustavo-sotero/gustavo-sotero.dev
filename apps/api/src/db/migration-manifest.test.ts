import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const drizzleDir = join(import.meta.dirname, '../../../../drizzle');
const journalPath = join(drizzleDir, 'meta/_journal.json');

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
  it('keeps journal entries unique and aligned with SQL files', () => {
    const journal = readJournal();
    const tags = journal.entries.map((entry) => entry.tag);

    expect(new Set(tags).size).toBe(tags.length);

    for (const tag of tags) {
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
});
