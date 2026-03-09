import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { limitMock, cachedMock } = vi.hoisted(() => ({
  limitMock: vi.fn(),
  cachedMock: vi.fn(),
}));

vi.mock('../../config/env', () => ({
  env: {
    ALLOWED_ORIGIN: 'https://site.example.com',
    API_PUBLIC_URL: 'https://api.example.com',
  },
}));

vi.mock('../../lib/cache', () => ({
  cached: cachedMock,
}));

vi.mock('../../config/db', () => {
  const orderByMock = vi.fn(() => ({ limit: limitMock }));
  const whereMock = vi.fn(() => ({ orderBy: orderByMock }));
  const fromMock = vi.fn(() => ({ where: whereMock }));
  const selectMock = vi.fn(() => ({ from: fromMock }));

  return {
    db: {
      select: selectMock,
    },
  };
});

import { feedRouter } from './feed';

describe('feed route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedMock.mockImplementation(async (_key, _ttl, fetcher) => fetcher());
    limitMock.mockResolvedValue([
      {
        slug: 'post-1',
        title: 'Post & 1',
        excerpt: 'Descrição <segura>',
        publishedAt: new Date('2026-02-20T10:00:00.000Z'),
        updatedAt: new Date('2026-02-20T10:00:00.000Z'),
      },
      {
        slug: 'post-2',
        title: 'Post 2',
        excerpt: null,
        publishedAt: null,
        updatedAt: new Date('2026-02-21T10:00:00.000Z'),
      },
    ]);
  });

  it('GET /feed.xml returns RSS XML with headers and max-items query limit', async () => {
    const app = new Hono();
    app.route('/', feedRouter);

    const response = await app.request('/feed.xml');
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/rss+xml');
    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=300'
    );
    expect(cachedMock).toHaveBeenCalledWith('feed:rss', 3600, expect.any(Function));
    expect(limitMock).toHaveBeenCalledWith(20);

    expect(xml).toContain('<rss version="2.0"');
    expect(xml).toContain('<title>Blog — Portfolio</title>');
    expect(xml).toContain('<link>https://site.example.com/blog/post-1</link>');
    expect(xml).toContain('<title>Post &amp; 1</title>');
    expect(xml).toContain('<description>Descrição &lt;segura&gt;</description>');
    expect(xml.match(/<item>/g)?.length).toBe(2);
  });
});
