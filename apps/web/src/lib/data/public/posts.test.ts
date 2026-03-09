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

const { getPublishedPostSlugs } = await import('./posts');
const { getPublicPosts } = await import('./posts');

describe('getPublicPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns public post listing from API', async () => {
    const payload = {
      success: true,
      data: [{ slug: 'post-1' }],
      meta: { page: 1, perPage: 9, total: 1, totalPages: 1 },
    };

    mockApiServerGetPaginated.mockResolvedValueOnce(payload);

    const result = await getPublicPosts();

    expect(result).toEqual(payload);
    expect(mockApiServerGetPaginated).toHaveBeenCalledWith('/posts?perPage=9');
  });

  it('propagates fetch errors instead of returning synthetic empty success', async () => {
    mockApiServerGetPaginated.mockRejectedValueOnce(new Error('api unavailable'));

    await expect(getPublicPosts()).rejects.toThrow('api unavailable');
  });
});

describe('getPublishedPostSlugs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('fetches all paginated post slugs', async () => {
    mockApiServerGetPaginated
      .mockResolvedValueOnce({
        success: true,
        data: [{ slug: 'post-1' }, { slug: 'post-2' }],
        meta: { page: 1, perPage: 100, total: 3, totalPages: 2 },
      })
      .mockResolvedValueOnce({
        success: true,
        data: [{ slug: 'post-3' }],
        meta: { page: 2, perPage: 100, total: 3, totalPages: 2 },
      });

    const slugs = await getPublishedPostSlugs();

    expect(slugs).toEqual(['post-1', 'post-2', 'post-3']);
    expect(mockApiServerGetPaginated).toHaveBeenCalledTimes(2);
    expect(mockApiServerGetPaginated).toHaveBeenNthCalledWith(1, '/posts?perPage=100&page=1');
    expect(mockApiServerGetPaginated).toHaveBeenNthCalledWith(2, '/posts?perPage=100&page=2');
  });

  it('throws when request fails', async () => {
    mockApiServerGetPaginated.mockRejectedValueOnce(new Error('network failure'));

    await expect(getPublishedPostSlugs()).rejects.toThrow('network failure');
  });
});
