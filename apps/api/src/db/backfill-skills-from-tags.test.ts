import { describe, expect, it, vi } from 'vitest';

const { resolveTagIconMock } = vi.hoisted(() => ({
  resolveTagIconMock: vi.fn((name: string) => ({ iconKey: `icon:${name.toLowerCase()}` })),
}));

vi.mock('@portfolio/shared/lib/iconResolver', () => ({
  resolveTagIcon: resolveTagIconMock,
}));

import { runSkillsCatalogBackfill } from './backfill-skills-from-tags';

function makeSkillRow(overrides: {
  id?: number;
  name: string;
  slug: string;
  category: 'language' | 'framework' | 'tool' | 'db' | 'cloud' | 'infra';
}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name,
    slug: overrides.slug,
    category: overrides.category,
  };
}

describe('runSkillsCatalogBackfill', () => {
  it('creates missing skills and links both project and experience pivots idempotently', async () => {
    const loadProjectTagRows = vi.fn().mockResolvedValue([
      {
        entityId: 10,
        tagId: 1,
        name: 'TypeScript',
        slug: 'typescript',
        category: 'language',
        isHighlighted: true,
      },
      {
        entityId: 10,
        tagId: 2,
        name: 'Hono',
        slug: 'hono',
        category: 'framework',
        isHighlighted: true,
      },
      {
        entityId: 11,
        tagId: 3,
        name: 'Docker',
        slug: 'docker',
        category: 'infra',
        isHighlighted: false,
      },
    ]);
    const loadExperienceTagRows = vi.fn().mockResolvedValue([
      {
        entityId: 20,
        tagId: 1,
        name: 'TypeScript',
        slug: 'typescript',
        category: 'language',
        isHighlighted: true,
      },
      {
        entityId: 20,
        tagId: 4,
        name: 'Redis',
        slug: 'redis',
        category: 'db',
        isHighlighted: false,
      },
    ]);
    const listExistingSkills = vi
      .fn()
      .mockResolvedValueOnce([
        makeSkillRow({ id: 1, name: 'TypeScript', slug: 'typescript', category: 'language' }),
      ])
      .mockResolvedValueOnce([
        makeSkillRow({ id: 1, name: 'TypeScript', slug: 'typescript', category: 'language' }),
        makeSkillRow({ id: 2, name: 'Hono', slug: 'hono', category: 'framework' }),
        makeSkillRow({ id: 3, name: 'Docker', slug: 'docker', category: 'infra' }),
        makeSkillRow({ id: 4, name: 'Redis', slug: 'redis', category: 'db' }),
      ]);
    const insertSkills = vi.fn().mockResolvedValue(undefined);
    const linkProjectSkills = vi.fn().mockResolvedValue(undefined);
    const linkExperienceSkills = vi.fn().mockResolvedValue(undefined);
    const logger = { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() };

    await runSkillsCatalogBackfill({
      loadProjectTagRows,
      loadExperienceTagRows,
      listExistingSkills,
      insertSkills,
      linkProjectSkills,
      linkExperienceSkills,
      loggerInstance: logger as never,
    });

    expect(insertSkills).toHaveBeenCalledWith([
      {
        name: 'Hono',
        slug: 'hono',
        category: 'framework',
        iconKey: 'icon:hono',
        expertiseLevel: 1,
        isHighlighted: 1,
      },
      {
        name: 'Docker',
        slug: 'docker',
        category: 'infra',
        iconKey: 'icon:docker',
        expertiseLevel: 1,
        isHighlighted: 0,
      },
      {
        name: 'Redis',
        slug: 'redis',
        category: 'db',
        iconKey: 'icon:redis',
        expertiseLevel: 1,
        isHighlighted: 0,
      },
    ]);
    expect(linkProjectSkills).toHaveBeenCalledWith([
      { projectId: 10, skillId: 1 },
      { projectId: 10, skillId: 2 },
      { projectId: 11, skillId: 3 },
    ]);
    expect(linkExperienceSkills).toHaveBeenCalledWith([
      { experienceId: 20, skillId: 1 },
      { experienceId: 20, skillId: 4 },
    ]);
    expect(logger.info).toHaveBeenCalledWith('Skill catalog backfill completed', {
      projectTagRows: 3,
      experienceTagRows: 2,
      createdSkills: 3,
      linkedProjectSkills: 3,
      linkedExperienceSkills: 2,
    });
  });

  it('throws when inserted skills still cannot be resolved for linking', async () => {
    const listExistingSkills = vi.fn().mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(
      runSkillsCatalogBackfill({
        loadProjectTagRows: async () => [
          {
            entityId: 10,
            tagId: 1,
            name: 'TypeScript',
            slug: 'typescript',
            category: 'language',
            isHighlighted: true,
          },
        ],
        loadExperienceTagRows: async () => [],
        listExistingSkills,
        insertSkills: vi.fn().mockResolvedValue(undefined),
        linkProjectSkills: vi.fn().mockResolvedValue(undefined),
        linkExperienceSkills: vi.fn().mockResolvedValue(undefined),
        loggerInstance: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } as never,
      })
    ).rejects.toThrow('Unable to resolve 1 skill(s) after backfill insert');
  });
});
