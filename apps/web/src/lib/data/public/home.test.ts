import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────

const { apiServerGetPaginatedMock, apiServerGetMock } = vi.hoisted(() => ({
  apiServerGetPaginatedMock: vi.fn(),
  apiServerGetMock: vi.fn(),
}));

vi.mock('@/lib/api.server', () => ({
  apiServerGetPaginated: apiServerGetPaginatedMock,
  apiServerGet: apiServerGetMock,
}));

// next/cache stubs — 'use cache' directive is a build-time feature; in tests
// we only need the exports to not throw.
vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_cache: vi.fn((fn: () => unknown) => fn),
}));

// server-only stub is already aliased in vitest.config.ts

import {
  getBlogTags,
  getHomeEducation,
  getHomeExperience,
  getHomeFeaturedProjects,
  getHomeProjectSkills,
  getHomeRecentPosts,
  getHomeSkills,
} from './home';

// ── Helpers ─────────────────────────────────────────────────────────────────

function makePaginatedResponse<T>(items: T[]) {
  return { data: items, meta: { page: 1, perPage: 3, total: items.length, totalPages: 1 } };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('getHomeFeaturedProjects', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok state with data when API responds with projects', async () => {
    const project = { id: 1, title: 'Portfolio', slug: 'portfolio' };
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([project]));

    const result = await getHomeFeaturedProjects();

    expect(result.state).toBe('ok');
    expect((result as { state: 'ok'; data: unknown[] }).data).toEqual([project]);
  });

  it('passes impactFacts through from API to loader result', async () => {
    const project = {
      id: 2,
      slug: 'projeto-destaque',
      impactFacts: ['Reduziu latência em 40%', 'Adotado por +200 devs'],
    };
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([project]));

    const result = await getHomeFeaturedProjects();

    expect(result.state).toBe('ok');
    const data = (result as { state: 'ok'; data: (typeof project)[] }).data;
    expect(data[0]?.impactFacts).toEqual(['Reduziu latência em 40%', 'Adotado por +200 devs']);
  });

  it('returns empty state when API responds with no projects', async () => {
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([]));

    const result = await getHomeFeaturedProjects();

    expect(result.state).toBe('empty');
    expect((result as { state: 'empty'; data: unknown[] }).data).toEqual([]);
  });

  it('returns degraded state when API throws', async () => {
    apiServerGetPaginatedMock.mockRejectedValueOnce(new Error('network error'));

    const result = await getHomeFeaturedProjects();

    expect(result.state).toBe('degraded');
    expect(result).not.toHaveProperty('data');
  });
});

describe('getHomeRecentPosts', () => {
  beforeEach(() => vi.clearAllMocks());

  it('requests manual ordering for the home posts carousel', async () => {
    const post = { id: 2, title: 'Redis Post', slug: 'redis-post' };
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([post]));

    await getHomeRecentPosts();

    expect(apiServerGetPaginatedMock).toHaveBeenCalledWith('/posts?perPage=3&sort=manual');
  });

  it('returns ok state with data when API responds with posts', async () => {
    const post = { id: 2, title: 'Redis Post', slug: 'redis-post' };
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([post]));

    const result = await getHomeRecentPosts();

    expect(result.state).toBe('ok');
    expect((result as { state: 'ok'; data: unknown[] }).data).toEqual([post]);
  });

  it('returns empty state when API responds with no posts', async () => {
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([]));

    const result = await getHomeRecentPosts();

    expect(result.state).toBe('empty');
  });

  it('returns degraded state when API throws', async () => {
    apiServerGetPaginatedMock.mockRejectedValueOnce(new Error('fetch failed'));

    const result = await getHomeRecentPosts();

    expect(result.state).toBe('degraded');
  });
});

describe('getHomeProjectSkills', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls /skills endpoint to get project skills', async () => {
    apiServerGetMock.mockResolvedValueOnce([]);

    await getHomeProjectSkills();

    expect(apiServerGetMock).toHaveBeenCalledWith('/skills');
  });

  it('returns ok state with skills when API responds with skills array', async () => {
    const skill = { id: 1, name: 'TypeScript', slug: 'typescript', category: 'language' };
    apiServerGetMock.mockResolvedValueOnce([skill]);

    const result = await getHomeProjectSkills();

    expect(result.state).toBe('ok');
    expect((result as { state: 'ok'; data: unknown[] }).data).toEqual([skill]);
  });

  it('returns empty state when API responds with empty array', async () => {
    apiServerGetMock.mockResolvedValueOnce([]);

    const result = await getHomeProjectSkills();

    expect(result.state).toBe('empty');
  });

  it('returns degraded state when API throws', async () => {
    apiServerGetMock.mockRejectedValueOnce(new Error('api unreachable'));

    const result = await getHomeProjectSkills();

    expect(result.state).toBe('degraded');
  });
});

describe('getHomeExperience', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok state with data when API responds with experience entries', async () => {
    const item = { id: 1, role: 'Backend Engineer' };
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([item]));

    const result = await getHomeExperience();

    expect(result.state).toBe('ok');
    expect((result as { state: 'ok'; data: unknown[] }).data).toEqual([item]);
  });

  it('passes impactFacts through from API to loader result', async () => {
    const item = {
      id: 1,
      role: 'Backend Engineer',
      impactFacts: ['Liderou squad de 4 devs', 'Reduziu bugs em 35%'],
    };
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([item]));

    const result = await getHomeExperience();

    expect(result.state).toBe('ok');
    const data = (result as { state: 'ok'; data: (typeof item)[] }).data;
    expect(data[0]?.impactFacts).toEqual(['Liderou squad de 4 devs', 'Reduziu bugs em 35%']);
  });

  it('returns empty state when API responds with no experience entries', async () => {
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([]));

    const result = await getHomeExperience();

    expect(result.state).toBe('empty');
  });

  it('returns degraded state when API throws', async () => {
    apiServerGetPaginatedMock.mockRejectedValueOnce(new Error('experience API down'));

    const result = await getHomeExperience();

    expect(result.state).toBe('degraded');
  });
});

describe('getHomeEducation', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok state with data when API responds with education entries', async () => {
    const item = { id: 1, title: 'Análise e Desenvolvimento de Sistemas' };
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([item]));

    const result = await getHomeEducation();

    expect(result.state).toBe('ok');
    expect((result as { state: 'ok'; data: unknown[] }).data).toEqual([item]);
  });

  it('returns empty state when API responds with no education entries', async () => {
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([]));

    const result = await getHomeEducation();

    expect(result.state).toBe('empty');
  });

  it('returns degraded state when API throws', async () => {
    apiServerGetPaginatedMock.mockRejectedValueOnce(new Error('education API down'));

    const result = await getHomeEducation();

    expect(result.state).toBe('degraded');
  });
});

describe('getHomeSkills', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls /skills?perPage=100 to fetch the full skill catalog', async () => {
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([]));

    await getHomeSkills();

    expect(apiServerGetPaginatedMock).toHaveBeenCalledWith('/skills?perPage=100');
  });

  it('returns ok state with skills when API responds with data', async () => {
    const skill = {
      id: 1,
      name: 'TypeScript',
      slug: 'typescript',
      category: 'language',
      expertiseLevel: 3,
      isHighlighted: true,
    };
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([skill]));

    const result = await getHomeSkills();

    expect(result.state).toBe('ok');
    expect((result as { state: 'ok'; data: unknown[] }).data).toEqual([skill]);
  });

  it('returns empty state when API responds with no skills', async () => {
    apiServerGetPaginatedMock.mockResolvedValueOnce(makePaginatedResponse([]));

    const result = await getHomeSkills();

    expect(result.state).toBe('empty');
  });

  it('returns degraded state when API throws', async () => {
    apiServerGetPaginatedMock.mockRejectedValueOnce(new Error('skills API down'));

    const result = await getHomeSkills();

    expect(result.state).toBe('degraded');
  });
});

describe('getBlogTags', () => {
  beforeEach(() => vi.clearAllMocks());

  it('calls /tags?source=post to restrict to blog/post tags', async () => {
    apiServerGetMock.mockResolvedValueOnce([]);

    await getBlogTags();

    expect(apiServerGetMock).toHaveBeenCalledWith('/tags?source=post');
  });

  it('returns ok state with tags when API responds with data', async () => {
    const tag = { id: 1, name: 'Node.js', slug: 'nodejs', category: 'tool' };
    apiServerGetMock.mockResolvedValueOnce([tag]);

    const result = await getBlogTags();

    expect(result.state).toBe('ok');
    expect((result as { state: 'ok'; data: unknown[] }).data).toEqual([tag]);
  });

  it('returns empty state when API responds with empty array', async () => {
    apiServerGetMock.mockResolvedValueOnce([]);

    const result = await getBlogTags();

    expect(result.state).toBe('empty');
  });

  it('returns degraded state when API throws', async () => {
    apiServerGetMock.mockRejectedValueOnce(new Error('tags API down'));

    const result = await getBlogTags();

    expect(result.state).toBe('degraded');
  });
});

// ── Aggregate loader tests ───────────────────────────────────────────────────

import { getHomeAggregate } from './home';

describe('getHomeAggregate', () => {
  beforeEach(() => vi.clearAllMocks());

  it('issues exactly 1 API call to GET /home', async () => {
    apiServerGetMock.mockResolvedValueOnce({
      posts: [],
      projects: [],
      skills: [],
      blogTags: [],
      experience: [],
      education: [],
    });

    await getHomeAggregate();

    expect(apiServerGetMock).toHaveBeenCalledOnce();
    expect(apiServerGetMock).toHaveBeenCalledWith('/home');
    expect(apiServerGetPaginatedMock).not.toHaveBeenCalled();
  });

  it('maps non-empty arrays to ok state', async () => {
    const post = { id: 1, title: 'Hello', slug: 'hello' };
    apiServerGetMock.mockResolvedValueOnce({
      posts: [post],
      projects: [],
      skills: [],
      blogTags: [],
      experience: [],
      education: [],
    });

    const result = await getHomeAggregate();

    expect(result.posts.state).toBe('ok');
    expect((result.posts as { state: 'ok'; data: unknown[] }).data).toEqual([post]);
  });

  it('maps empty arrays to empty state', async () => {
    apiServerGetMock.mockResolvedValueOnce({
      posts: [],
      projects: [],
      skills: [],
      blogTags: [],
      experience: [],
      education: [],
    });

    const result = await getHomeAggregate();

    expect(result.posts.state).toBe('empty');
    expect(result.projects.state).toBe('empty');
    expect(result.skills.state).toBe('empty');
    expect(result.blogTags.state).toBe('empty');
    expect(result.experience.state).toBe('empty');
    expect(result.education.state).toBe('empty');
  });

  it('returns all sections as degraded when API throws', async () => {
    apiServerGetMock.mockRejectedValueOnce(new Error('aggregate endpoint down'));

    const result = await getHomeAggregate();

    expect(result.posts.state).toBe('degraded');
    expect(result.projects.state).toBe('degraded');
    expect(result.skills.state).toBe('degraded');
    expect(result.blogTags.state).toBe('degraded');
    expect(result.experience.state).toBe('degraded');
    expect(result.education.state).toBe('degraded');
    expect(apiServerGetMock).toHaveBeenCalledOnce();
  });
});
