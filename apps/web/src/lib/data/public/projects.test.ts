import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockApiServerGetPaginated = vi.fn();

vi.mock('next/cache', () => ({
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}));

vi.mock('@/lib/api.server', () => ({
  apiServerGetPaginated: (...args: unknown[]) => mockApiServerGetPaginated(...args),
  apiServerGet: vi.fn(),
}));

const { getPublishedProjectSlugs } = await import('./projects');
const { getPublicProjects } = await import('./projects');

describe('getPublicProjects', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns public projects listing from API', async () => {
    const payload = {
      success: true,
      data: [{ slug: 'project-1' }],
      meta: { page: 1, perPage: 9, total: 1, totalPages: 1 },
    };

    mockApiServerGetPaginated.mockResolvedValueOnce(payload);

    const result = await getPublicProjects();

    expect(result).toEqual(payload);
    expect(mockApiServerGetPaginated).toHaveBeenCalledWith('/projects?perPage=9');
  });

  it('propagates fetch errors instead of returning synthetic empty success', async () => {
    mockApiServerGetPaginated.mockRejectedValueOnce(new Error('api unavailable'));

    await expect(getPublicProjects()).rejects.toThrow('api unavailable');
  });
});

describe('getPublishedProjectSlugs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches all paginated project slugs', async () => {
    mockApiServerGetPaginated
      .mockResolvedValueOnce({
        success: true,
        data: [{ slug: 'project-1' }, { slug: 'project-2' }],
        meta: { page: 1, perPage: 100, total: 3, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        success: true,
        data: [{ slug: 'project-3' }],
        meta: { page: 2, perPage: 100, total: 3, totalPages: 2 },
      });

    const slugs = await getPublishedProjectSlugs();

    expect(slugs).toEqual(['project-1', 'project-2', 'project-3']);
    expect(mockApiServerGetPaginated).toHaveBeenCalledTimes(2);
    expect(mockApiServerGetPaginated).toHaveBeenNthCalledWith(1, '/projects?perPage=100&page=1');
    expect(mockApiServerGetPaginated).toHaveBeenNthCalledWith(2, '/projects?perPage=100&page=2');
  });

  it('throws when request fails', async () => {
    mockApiServerGetPaginated.mockRejectedValueOnce(new Error('network failure'));

    await expect(getPublishedProjectSlugs()).rejects.toThrow('network failure');
  });
});
