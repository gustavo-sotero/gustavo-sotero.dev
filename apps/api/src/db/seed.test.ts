/**
 * Seed data integrity tests — Plan §13.3
 *
 * These are pure unit tests (no DB connection required).
 * They validate the static SEED_TAGS data so that regressions
 * are caught immediately if someone adds a seed tag without iconKey.
 */
import { describe, expect, it } from 'vitest';
import {
  SEED_EDUCATION,
  SEED_EXPERIENCE,
  SEED_POSTS,
  SEED_PROJECTS,
  SEED_SKILLS,
  SEED_TAGS,
} from './seed';

function expectUniqueValues(values: string[]) {
  expect(new Set(values).size).toBe(values.length);
}

function hasMermaidFence(content: string) {
  return /(^|\n)(```|~~~)mermaid\b/m.test(content);
}

describe('SEED_TAGS data integrity', () => {
  // Plan §13.3.1 — All predefined seed items have iconKey (backfill precondition)
  it('every seed tag has a non-null, non-empty iconKey', () => {
    const missing = SEED_TAGS.filter(
      (seedTag) => !seedTag.iconKey || seedTag.iconKey.trim() === ''
    );
    expect(missing).toHaveLength(0);
  });

  it('every seed tag iconKey uses a valid prefix (si: or lucide:)', () => {
    const invalid = SEED_TAGS.filter(
      (seedTag) =>
        seedTag.iconKey &&
        !seedTag.iconKey.startsWith('si:') &&
        !seedTag.iconKey.startsWith('lucide:')
    );
    expect(invalid).toHaveLength(0);
  });

  // Plan §13.3.2 — Slug uniqueness (idempotency relies on unique slug)
  it('all seed tag slugs are unique (required for ON CONFLICT DO NOTHING)', () => {
    expectUniqueValues(SEED_TAGS.map((seedTag) => seedTag.slug));
  });

  it('all seed tag names are unique', () => {
    expectUniqueValues(SEED_TAGS.map((seedTag) => seedTag.name.toLowerCase()));
  });

  // Drizzle ORM specifically — previously had null iconKey in legacy seeds
  it('Drizzle ORM seed tag has a valid iconKey after backfill update', () => {
    const drizzleTag = SEED_TAGS.find((seedTag) => seedTag.slug === 'drizzle');
    expect(drizzleTag).toBeDefined();
    expect(drizzleTag?.iconKey).toBeTruthy();
    expect(
      drizzleTag?.iconKey?.startsWith('si:') || drizzleTag?.iconKey?.startsWith('lucide:')
    ).toBe(true);
  });

  it('keeps canonical categories for runtime and infra seed tags', () => {
    const nodeTag = SEED_TAGS.find((seedTag) => seedTag.slug === 'nodejs');
    const dockerTag = SEED_TAGS.find((seedTag) => seedTag.slug === 'docker');

    expect(nodeTag?.category).toBe('tool');
    expect(dockerTag?.category).toBe('infra');
  });
});

describe('portfolio restore seed data integrity', () => {
  it('keeps content slugs unique across restored entities', () => {
    expectUniqueValues(SEED_POSTS.map((seedPost) => seedPost.slug));
    expectUniqueValues(SEED_PROJECTS.map((seedProject) => seedProject.slug));
    expectUniqueValues(SEED_EXPERIENCE.map((seedExperience) => seedExperience.slug));
    expectUniqueValues(SEED_EDUCATION.map((educationItem) => educationItem.slug));
    expectUniqueValues(SEED_SKILLS.map((seedSkill) => seedSkill.slug));
  });

  it('references only existing post tag slugs', () => {
    const tagSlugs = new Set(SEED_TAGS.map((seedTag) => seedTag.slug));
    const missingTagSlugs = SEED_POSTS.flatMap((seedPost) => seedPost.tagSlugs).filter(
      (slug) => !tagSlugs.has(slug)
    );

    expect(missingTagSlugs).toEqual([]);
  });

  it('references only existing skill slugs for projects and experience', () => {
    const skillSlugs = new Set(SEED_SKILLS.map((seedSkill) => seedSkill.slug));
    const projectSkillSlugs = SEED_PROJECTS.flatMap((seedProject) => seedProject.skillSlugs);
    const experienceSkillSlugs = SEED_EXPERIENCE.flatMap(
      (seedExperience) => seedExperience.skillSlugs
    );
    const missingSkillSlugs = [...projectSkillSlugs, ...experienceSkillSlugs].filter(
      (slug) => !skillSlugs.has(slug)
    );

    expect(missingSkillSlugs).toEqual([]);
  });

  it('contains the requested portfolio projects and LinkedIn-derived posts', () => {
    expect(SEED_PROJECTS.map((seedProject) => seedProject.slug)).toEqual([
      'notz-sms',
      'urlfy',
      'anonshare',
      'fullstack-portfolio',
    ]);
    expect(SEED_POSTS.map((seedPost) => seedPost.slug)).toEqual([
      'feature-flag-nao-e-deploy-condicional',
      'algebra-booleana-regras-de-negocio',
      'cache-stampede-redis-postgresql',
      'ieee-754-sistemas-financeiros',
      'swallow-silencioso-typescript',
      'fila-nao-e-gratis',
    ]);
  });

  it('keeps project and experience impact facts within API limits', () => {
    const impactFactGroups = [
      ...SEED_PROJECTS.map((seedProject) => seedProject.impactFacts),
      ...SEED_EXPERIENCE.map((seedExperience) => seedExperience.impactFacts),
    ];

    for (const impactFacts of impactFactGroups) {
      expect(impactFacts.length).toBeLessThanOrEqual(6);
      expect(impactFacts.every((fact) => fact.trim().length > 0 && fact.length <= 200)).toBe(true);
    }
  });

  it('keeps mermaid diagrams only in the selected architecture-heavy restored entries', () => {
    const mermaidPostSlugs = SEED_POSTS.filter((seedPost) => hasMermaidFence(seedPost.content)).map(
      (seedPost) => seedPost.slug
    );
    const mermaidProjectSlugs = SEED_PROJECTS.filter((seedProject) =>
      hasMermaidFence(seedProject.content)
    ).map((seedProject) => seedProject.slug);

    expect(mermaidPostSlugs).toEqual(['cache-stampede-redis-postgresql', 'fila-nao-e-gratis']);
    expect(mermaidProjectSlugs).toEqual(['notz-sms', 'urlfy', 'anonshare', 'fullstack-portfolio']);
  });
});
