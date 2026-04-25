import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  findManySkillsMock,
  findManyPostsMock,
  findManyProjectsMock,
  findManyExperienceMock,
  findManyEducationMock,
  getPageviewCountMock,
} = vi.hoisted(() => ({
  findManySkillsMock: vi.fn(),
  findManyPostsMock: vi.fn(),
  findManyProjectsMock: vi.fn(),
  findManyExperienceMock: vi.fn(),
  findManyEducationMock: vi.fn(),
  getPageviewCountMock: vi.fn(),
}));

vi.mock('../lib/cache', () => ({
  // Bypass Redis — execute the fetcher immediately.
  cached: vi.fn((_key: string, _ttl: number, fetcher: () => unknown) => fetcher()),
  invalidatePattern: vi.fn(),
  invalidateGroup: vi.fn(),
}));

vi.mock('../lib/pivotHelpers', () => ({
  flattenPivotTagArray: vi.fn((arr: Array<{ tag: unknown }>) => arr.map((r) => r.tag)),
  flattenPivotSkillArray: vi.fn((arr: Array<{ skill: unknown }>) => arr.map((r) => r.skill)),
}));

vi.mock('../repositories/skills.repo', () => ({ findManySkills: findManySkillsMock }));
vi.mock('../repositories/posts.repo', () => ({ findManyPosts: findManyPostsMock }));
vi.mock('../repositories/projects.repo', () => ({ findManyProjects: findManyProjectsMock }));
vi.mock('../repositories/experience.repo', () => ({ findManyExperience: findManyExperienceMock }));
vi.mock('../repositories/education.repo', () => ({ findManyEducation: findManyEducationMock }));
vi.mock('../repositories/analytics.repo', () => ({ getPageviewCount: getPageviewCountMock }));

vi.mock('@portfolio/shared', () => ({
  DEVELOPER_PUBLIC_PROFILE: {
    name: 'Gustavo Sotero',
    role: 'Desenvolvedor Fullstack',
    bio: 'Bio de teste',
    availability: true,
    links: {
      github: 'https://github.com/gustavo-sotero',
      linkedin: 'https://linkedin.com/in/test',
    },
  },
}));

import { getDeveloperProfile } from './developer-profile.service';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeEmptyPaginated<T>(data: T[] = []) {
  return { data, meta: { page: 1, perPage: 10, total: data.length, totalPages: 1 } };
}

function makeMockSkill(
  overrides: Partial<{
    id: number;
    name: string;
    category: string;
    expertiseLevel: number;
    isHighlighted: number;
    createdAt: string;
  }> = {}
) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'TypeScript',
    slug: 'typescript',
    category: overrides.category ?? 'language',
    iconKey: null,
    expertiseLevel: overrides.expertiseLevel ?? 3,
    isHighlighted: overrides.isHighlighted ?? 0,
    createdAt: overrides.createdAt ?? '2025-01-01T00:00:00.000Z',
  };
}

function setupDefaultMocks() {
  findManySkillsMock.mockResolvedValue(makeEmptyPaginated());
  findManyPostsMock.mockResolvedValue(makeEmptyPaginated());
  findManyProjectsMock.mockResolvedValue(makeEmptyPaginated());
  findManyExperienceMock.mockResolvedValue(makeEmptyPaginated());
  findManyEducationMock.mockResolvedValue(makeEmptyPaginated());
  getPageviewCountMock.mockResolvedValue(0);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('developer-profile service — stack source alignment', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  it('fetches skills from the skill catalog to build the stack', async () => {
    await getDeveloperProfile();

    expect(findManySkillsMock).toHaveBeenCalledWith({});
  });

  it('totalSkillsInCatalog reflects the skill count returned by the repo', async () => {
    const mockSkills = [
      makeMockSkill({ id: 1 }),
      makeMockSkill({ id: 2, name: 'Bun', category: 'tool' }),
    ];
    findManySkillsMock.mockResolvedValue(makeEmptyPaginated(mockSkills));

    const result = await getDeveloperProfile();

    // meta.total from skillsResult is used directly for the metric
    expect(result.metrics.totalSkillsInCatalog).toBe(2);
  });

  it('stack.groups are populated from the skill catalog', async () => {
    const langSkill = makeMockSkill({ id: 1, name: 'TypeScript', category: 'language' });
    const toolSkill = makeMockSkill({ id: 2, name: 'Docker', category: 'tool' });
    findManySkillsMock.mockResolvedValue(makeEmptyPaginated([langSkill, toolSkill]));

    const result = await getDeveloperProfile();

    expect(result.stack.groups.language).toEqual([
      {
        id: 1,
        name: 'TypeScript',
        slug: 'typescript',
        category: 'language',
        iconKey: null,
        expertiseLevel: 3,
        isHighlighted: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ]);
    expect(result.stack.groups.tool).toEqual([
      {
        id: 2,
        name: 'Docker',
        slug: 'typescript',
        category: 'tool',
        iconKey: null,
        expertiseLevel: 3,
        isHighlighted: false,
        createdAt: '2025-01-01T00:00:00.000Z',
      },
    ]);
    expect(result.stack.groups.framework).toEqual([]);
  });

  it('totalSkillsInCatalog and stack.groups count agree when all skills are in a single category', async () => {
    const skillList = [
      makeMockSkill({ id: 1, name: 'TypeScript', category: 'language' }),
      makeMockSkill({ id: 2, name: 'JavaScript', category: 'language' }),
      makeMockSkill({ id: 3, name: 'Python', category: 'language' }),
    ];
    findManySkillsMock.mockResolvedValue(makeEmptyPaginated(skillList));

    const result = await getDeveloperProfile();

    const totalInGroups = Object.values(result.stack.groups).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    expect(result.metrics.totalSkillsInCatalog).toBe(3);
    expect(totalInGroups).toBe(3);
  });

  it('projects impactFacts for experience and projects into the aggregate payload', async () => {
    findManyExperienceMock.mockResolvedValue(
      makeEmptyPaginated([
        {
          id: 1,
          slug: 'backend-engineer',
          company: 'Acme',
          role: 'Backend Engineer',
          description: 'Backend platform work',
          location: null,
          employmentType: null,
          startDate: '2024-01-01',
          endDate: null,
          isCurrent: true,
          order: 0,
          impactFacts: ['Reduziu tempo de deploy em 60%'],
          logoUrl: null,
        },
      ])
    );
    findManyProjectsMock.mockResolvedValue(
      makeEmptyPaginated([
        {
          id: 2,
          slug: 'portfolio-api',
          title: 'Portfolio API',
          description: 'REST API',
          coverUrl: null,
          featured: true,
          repositoryUrl: null,
          liveUrl: null,
          impactFacts: ['Reduziu latência em 40%'],
          createdAt: '2025-01-01T00:00:00.000Z',
          updatedAt: '2025-02-01T00:00:00.000Z',
          skills: [],
        },
      ])
    );

    const result = await getDeveloperProfile();

    expect(result.experience[0]?.impactFacts).toEqual(['Reduziu tempo de deploy em 60%']);
    expect(result.projects[0]?.impactFacts).toEqual(['Reduziu latência em 40%']);
  });
});
