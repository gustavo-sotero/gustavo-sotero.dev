import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cachedMock, dbSelectMock, getPageviewCountMock, getTopPathsMock } = vi.hoisted(() => ({
  cachedMock: vi.fn(),
  dbSelectMock: vi.fn(),
  getPageviewCountMock: vi.fn(),
  getTopPathsMock: vi.fn(),
}));

vi.mock('../lib/cache', () => ({
  cached: cachedMock,
}));

vi.mock('../config/db', () => ({
  db: {
    select: dbSelectMock,
  },
}));

vi.mock('../repositories/analytics.repo', () => ({
  getPageviewCount: getPageviewCountMock,
  getTopPaths: getTopPathsMock,
}));

import { getAnalyticsSummary, getAnalyticsTopPosts, toDateKey } from './analytics.service';

function makeCountQuery(total: number) {
  return {
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ total }]),
    })),
  };
}

describe('analytics.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedMock.mockImplementation(
      async (_key: string, _ttl: number, fetcher: () => Promise<unknown>) => fetcher()
    );
  });

  it('normalizes date keys to YYYY-MM-DD', () => {
    expect(toDateKey(new Date('2026-05-01T18:44:30.000Z'))).toBe('2026-05-01');
  });

  it('builds the analytics summary via cached composition', async () => {
    const from = new Date('2026-03-01T00:00:00.000Z');
    const to = new Date('2026-03-15T00:00:00.000Z');

    getPageviewCountMock.mockResolvedValue(120);
    dbSelectMock
      .mockReturnValueOnce(makeCountQuery(12))
      .mockReturnValueOnce(makeCountQuery(5))
      .mockReturnValueOnce(makeCountQuery(4));

    await expect(getAnalyticsSummary({ from, to })).resolves.toEqual({
      pageviews: 120,
      pendingComments: 4,
      publishedPosts: 12,
      publishedProjects: 5,
      from: '2026-03-01T00:00:00.000Z',
      to: '2026-03-15T00:00:00.000Z',
    });

    expect(cachedMock).toHaveBeenCalledWith(
      'analytics:summary:2026-03-01:2026-03-15',
      300,
      expect.any(Function)
    );
    expect(getPageviewCountMock).toHaveBeenCalledWith({ from, to });
    expect(dbSelectMock).toHaveBeenCalledTimes(3);
  });

  it('builds top-posts data via cached repository lookup', async () => {
    const from = new Date('2026-03-01T00:00:00.000Z');
    const to = new Date('2026-03-15T00:00:00.000Z');
    const topPosts = [
      { path: '/posts/a', views: 20 },
      { path: '/posts/b', views: 8 },
    ];
    getTopPathsMock.mockResolvedValue(topPosts);

    await expect(getAnalyticsTopPosts({ from, to, limit: 10 })).resolves.toEqual(topPosts);

    expect(cachedMock).toHaveBeenCalledWith(
      'analytics:top-posts:2026-03-01:2026-03-15:10',
      300,
      expect.any(Function)
    );
    expect(getTopPathsMock).toHaveBeenCalledWith({ from, to, limit: 10 });
  });
});
