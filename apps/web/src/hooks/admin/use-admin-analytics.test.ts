import { beforeEach, describe, expect, it, vi } from 'vitest';

const { apiGetMock, useQueryMock } = vi.hoisted(() => ({
  apiGetMock: vi.fn(),
  useQueryMock: vi.fn(),
}));

vi.mock('@/lib/api', () => ({
  apiGet: (...args: unknown[]) => apiGetMock(...args),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: (options: Record<string, unknown>) => {
    useQueryMock(options);
    return options;
  },
}));

import { useAnalyticsSummary, useAnalyticsTopPosts } from './use-admin-analytics';

describe('admin analytics hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('configures live refresh for summary queries', async () => {
    const result = useAnalyticsSummary({ from: '2026-04-01', to: '2026-04-24' });

    expect(useQueryMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      staleTime: 0,
      refetchInterval: 5_000,
      refetchIntervalInBackground: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    });

    apiGetMock.mockResolvedValueOnce({ data: { pageviews: 1 } });
    await expect((result.queryFn as () => Promise<unknown>)()).resolves.toEqual({ pageviews: 1 });
    expect(apiGetMock).toHaveBeenCalledWith(
      '/admin/analytics/summary?from=2026-04-01&to=2026-04-24'
    );
  });

  it('configures live refresh for top-post queries', async () => {
    const result = useAnalyticsTopPosts({ from: '2026-04-01', to: '2026-04-24', limit: 8 });

    expect(useQueryMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      staleTime: 0,
      refetchInterval: 5_000,
      refetchIntervalInBackground: true,
      refetchOnReconnect: true,
      refetchOnWindowFocus: true,
    });

    apiGetMock.mockResolvedValueOnce({ data: [{ path: '/posts/teste', views: 3 }] });
    await expect((result.queryFn as () => Promise<unknown>)()).resolves.toEqual([
      { path: '/posts/teste', views: 3 },
    ]);
    expect(apiGetMock).toHaveBeenCalledWith(
      '/admin/analytics/top-posts?from=2026-04-01&to=2026-04-24&limit=8'
    );
  });
});
