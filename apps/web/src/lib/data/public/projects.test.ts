import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiServerGetPaginated = vi.fn();
const mockApiServerGet = vi.fn();

class MockApiNotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`);
    this.name = 'ApiNotFoundError';
  }
}

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock('@/lib/api.server', () => ({
  apiServerGetPaginated: (...args: unknown[]) => mockApiServerGetPaginated(...args),
  apiServerGet: (...args: unknown[]) => mockApiServerGet(...args),
  ApiNotFoundError: MockApiNotFoundError,
}));

const { getPublicProjectDetail, getPublicProjects } = await import('./projects');

describe('getPublicProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok state when API responds with projects', async () => {
    const meta = { page: 1, perPage: 9, total: 1, totalPages: 1 };
    mockApiServerGetPaginated.mockResolvedValueOnce({
      success: true,
      data: [{ slug: 'project-1' }],
      meta,
    });

    const result = await getPublicProjects();

    expect(result.state).toBe('ok');
    expect((result as Extract<typeof result, { data: unknown }>).data).toEqual([
      { slug: 'project-1' },
    ]);
    expect((result as Extract<typeof result, { data: unknown }>).meta).toEqual(meta);
    expect(mockApiServerGetPaginated).toHaveBeenCalledWith('/projects?perPage=9');
  });

  it('passes impactFacts through from API to paginated list result', async () => {
    const meta = { page: 1, perPage: 9, total: 1, totalPages: 1 };
    mockApiServerGetPaginated.mockResolvedValueOnce({
      success: true,
      data: [{ slug: 'projeto-1', impactFacts: ['Reduziu latência em 40%'] }],
      meta,
    });

    const result = await getPublicProjects();

    expect(result.state).toBe('ok');
    const data = (result as Extract<typeof result, { data: unknown[] }>).data as Array<{
      impactFacts: string[];
    }>;
    expect(data[0]?.impactFacts).toEqual(['Reduziu latência em 40%']);
  });

  it('returns empty state when API responds with no projects', async () => {
    const meta = { page: 1, perPage: 9, total: 0, totalPages: 0 };
    mockApiServerGetPaginated.mockResolvedValueOnce({
      success: true,
      data: [],
      meta,
    });

    const result = await getPublicProjects();

    expect(result.state).toBe('empty');
    expect((result as Extract<typeof result, { data: unknown }>).data).toEqual([]);
  });

  it('returns degraded state when API is unavailable — build must not fail', async () => {
    mockApiServerGetPaginated.mockRejectedValueOnce(new Error('api unavailable'));

    const result = await getPublicProjects();

    expect(result.state).toBe('degraded');
    expect(result).not.toHaveProperty('data');
  });
});

describe('getPublicProjectDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok state when API responds with a project', async () => {
    const project = { slug: 'project-1', title: 'Project 1' };
    mockApiServerGet.mockResolvedValueOnce(project);

    const result = await getPublicProjectDetail('project-1');

    expect(result).toEqual({ state: 'ok', data: project });
    expect(mockApiServerGet).toHaveBeenCalledWith('/projects/project-1');
  });

  it('passes impactFacts through from API in project detail result', async () => {
    const project = {
      slug: 'projeto-impacto',
      title: 'Projeto Impacto',
      impactFacts: ['Reduziu latência em 40%', 'Adotado por +200 devs'],
    };
    mockApiServerGet.mockResolvedValueOnce(project);

    const result = await getPublicProjectDetail('projeto-impacto');

    expect(result.state).toBe('ok');
    const data = (result as { state: 'ok'; data: typeof project }).data;
    expect(data.impactFacts).toEqual(['Reduziu latência em 40%', 'Adotado por +200 devs']);
  });

  it('returns not-found when API responds with 404', async () => {
    mockApiServerGet.mockRejectedValueOnce(new MockApiNotFoundError('/projects/missing'));

    const result = await getPublicProjectDetail('missing');

    expect(result).toEqual({ state: 'not-found' });
  });

  it('returns degraded when API is unavailable', async () => {
    mockApiServerGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await getPublicProjectDetail('project-1');

    expect(result).toEqual({ state: 'degraded' });
  });
});
