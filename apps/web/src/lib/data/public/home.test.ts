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
  getHomeEducation,
  getHomeExperience,
  getHomeFeaturedProjects,
  getHomeRecentPosts,
  getHomeTags,
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

describe('getHomeTags', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns ok state with tags when API responds with tags array', async () => {
    const tag = { id: 1, name: 'TypeScript', slug: 'typescript', category: 'language' };
    apiServerGetMock.mockResolvedValueOnce([tag]);

    const result = await getHomeTags();

    expect(result.state).toBe('ok');
    expect((result as { state: 'ok'; data: unknown[] }).data).toEqual([tag]);
  });

  it('returns empty state when API responds with empty array', async () => {
    apiServerGetMock.mockResolvedValueOnce([]);

    const result = await getHomeTags();

    expect(result.state).toBe('empty');
  });

  it('returns degraded state when API throws', async () => {
    apiServerGetMock.mockRejectedValueOnce(new Error('api unreachable'));

    const result = await getHomeTags();

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
