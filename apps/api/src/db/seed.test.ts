/**
 * Seed data integrity tests — Plan §13.3
 *
 * These are pure unit tests (no DB connection required).
 * They validate the static SEED_TAGS data so that regressions
 * are caught immediately if someone adds a seed tag without iconKey.
 */
import { describe, expect, it } from 'vitest';
import { SEED_TAGS } from './seed';

describe('SEED_TAGS data integrity', () => {
  // Plan §13.3.1 — All predefined seed items have iconKey (backfill precondition)
  it('every seed tag has a non-null, non-empty iconKey', () => {
    const missing = SEED_TAGS.filter((t) => !t.iconKey || t.iconKey.trim() === '');
    expect(missing).toHaveLength(0);
  });

  it('every seed tag iconKey uses a valid prefix (si: or lucide:)', () => {
    const invalid = SEED_TAGS.filter(
      (t) => t.iconKey && !t.iconKey.startsWith('si:') && !t.iconKey.startsWith('lucide:')
    );
    expect(invalid).toHaveLength(0);
  });

  // Plan §13.3.2 — Slug uniqueness (idempotency relies on unique slug)
  it('all seed tag slugs are unique (required for ON CONFLICT DO NOTHING)', () => {
    const slugs = SEED_TAGS.map((t) => t.slug);
    const unique = new Set(slugs);
    expect(unique.size).toBe(slugs.length);
  });

  it('all seed tag names are unique', () => {
    const names = SEED_TAGS.map((t) => t.name.toLowerCase());
    const unique = new Set(names);
    expect(unique.size).toBe(names.length);
  });

  // Drizzle ORM specifically — previously had null iconKey in legacy seeds
  it('Drizzle ORM seed tag has a valid iconKey after backfill update', () => {
    const drizzleTag = SEED_TAGS.find((t) => t.slug === 'drizzle');
    expect(drizzleTag).toBeDefined();
    expect(drizzleTag?.iconKey).toBeTruthy();
    expect(
      drizzleTag?.iconKey?.startsWith('si:') || drizzleTag?.iconKey?.startsWith('lucide:')
    ).toBe(true);
  });

  it('keeps canonical categories for runtime and infra seed tags', () => {
    const nodeTag = SEED_TAGS.find((t) => t.slug === 'nodejs');
    const dockerTag = SEED_TAGS.find((t) => t.slug === 'docker');

    expect(nodeTag?.category).toBe('tool');
    expect(dockerTag?.category).toBe('infra');
  });
});
