import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const {
  findManyTagsMock,
  findManyPostsMock,
  findManyProjectsMock,
  findManyExperienceMock,
  findManyEducationMock,
  getPageviewCountMock,
} = vi.hoisted(() => ({
  findManyTagsMock: vi.fn(),
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
}));

vi.mock('../repositories/tags.repo', () => ({ findManyTags: findManyTagsMock }));
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

function makeMockTag(overrides: Partial<{ id: number; name: string; category: string }> = {}) {
  return {
    id: overrides.id ?? 1,
    name: overrides.name ?? 'TypeScript',
    slug: 'typescript',
    category: overrides.category ?? 'language',
    iconKey: null,
  };
}

function setupDefaultMocks() {
  findManyTagsMock.mockResolvedValue(makeEmptyPaginated());
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

  it('fetches tags with source=project so stack reflects only project tags', async () => {
    await getDeveloperProfile();

    expect(findManyTagsMock).toHaveBeenCalledWith({ source: 'project' }, true);
  });

  it('totalTagsInUse reflects the same project-only tag count as stack', async () => {
    const mockTags = [
      makeMockTag({ id: 1 }),
      makeMockTag({ id: 2, name: 'Bun', category: 'tool' }),
    ];
    findManyTagsMock.mockResolvedValue(makeEmptyPaginated(mockTags));

    const result = await getDeveloperProfile();

    // meta.total from tagsResult is used directly for the metric
    expect(result.metrics.totalTagsInUse).toBe(2);
  });

  it('stack.groups are populated from project-only tags', async () => {
    const langTag = makeMockTag({ id: 1, name: 'TypeScript', category: 'language' });
    const toolTag = makeMockTag({ id: 2, name: 'Docker', category: 'tool' });
    findManyTagsMock.mockResolvedValue(makeEmptyPaginated([langTag, toolTag]));

    const result = await getDeveloperProfile();

    expect(result.stack.groups.language).toEqual([
      { id: 1, name: 'TypeScript', slug: 'typescript', category: 'language', iconKey: null },
    ]);
    expect(result.stack.groups.tool).toEqual([
      { id: 2, name: 'Docker', slug: 'typescript', category: 'tool', iconKey: null },
    ]);
    expect(result.stack.groups.framework).toEqual([]);
  });

  it('totalTagsInUse and stack.groups count agree when all tags are in a single category', async () => {
    const tags = [
      makeMockTag({ id: 1, name: 'TypeScript', category: 'language' }),
      makeMockTag({ id: 2, name: 'JavaScript', category: 'language' }),
      makeMockTag({ id: 3, name: 'Python', category: 'language' }),
    ];
    findManyTagsMock.mockResolvedValue(makeEmptyPaginated(tags));

    const result = await getDeveloperProfile();

    const totalInGroups = Object.values(result.stack.groups).reduce(
      (sum, arr) => sum + arr.length,
      0
    );
    expect(result.metrics.totalTagsInUse).toBe(3);
    expect(totalInGroups).toBe(3);
  });
});
