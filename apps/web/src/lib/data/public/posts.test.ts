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

const { getPublicPostDetail, getPublicPosts } = await import('./posts');

describe('getPublicPosts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok state when API responds with posts', async () => {
    const meta = { page: 1, perPage: 9, total: 1, totalPages: 1 };
    mockApiServerGetPaginated.mockResolvedValueOnce({
      success: true,
      data: [{ slug: 'post-1' }],
      meta,
    });

    const result = await getPublicPosts();

    expect(result.state).toBe('ok');
    expect((result as Extract<typeof result, { data: unknown }>).data).toEqual([
      { slug: 'post-1' },
    ]);
    expect((result as Extract<typeof result, { data: unknown }>).meta).toEqual(meta);
    expect(mockApiServerGetPaginated).toHaveBeenCalledWith('/posts?perPage=9');
  });

  it('returns empty state when API responds with no posts', async () => {
    const meta = { page: 1, perPage: 9, total: 0, totalPages: 0 };
    mockApiServerGetPaginated.mockResolvedValueOnce({
      success: true,
      data: [],
      meta,
    });

    const result = await getPublicPosts();

    expect(result.state).toBe('empty');
    expect((result as Extract<typeof result, { data: unknown }>).data).toEqual([]);
  });

  it('returns degraded state when API is unavailable — build must not fail', async () => {
    mockApiServerGetPaginated.mockRejectedValueOnce(new Error('api unavailable'));

    const result = await getPublicPosts();

    expect(result.state).toBe('degraded');
    expect(result).not.toHaveProperty('data');
  });
});

describe('getPublicPostDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok state when API responds with a post', async () => {
    const post = { slug: 'post-1', title: 'Post 1' };
    mockApiServerGet.mockResolvedValueOnce(post);

    const result = await getPublicPostDetail('post-1');

    expect(result).toEqual({ state: 'ok', data: post });
    expect(mockApiServerGet).toHaveBeenCalledWith('/posts/post-1');
  });

  it('returns not-found when API responds with 404', async () => {
    mockApiServerGet.mockRejectedValueOnce(new MockApiNotFoundError('/posts/missing'));

    const result = await getPublicPostDetail('missing');

    expect(result).toEqual({ state: 'not-found' });
  });

  it('returns degraded when API is unavailable', async () => {
    mockApiServerGet.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const result = await getPublicPostDetail('post-1');

    expect(result).toEqual({ state: 'degraded' });
  });
});
