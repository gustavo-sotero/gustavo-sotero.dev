import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cachedMock, selectMock } = vi.hoisted(() => ({
  cachedMock: vi.fn(),
  selectMock: vi.fn(),
}));

vi.mock('../../config/env', () => ({
  env: {
    ALLOWED_ORIGIN: 'https://site.example.com',
    // Uses the official path-based topology as primary fixture (https://example.com/api).
    API_PUBLIC_URL: 'https://example.com/api',
  },
}));

vi.mock('../../lib/cache', () => ({
  cached: cachedMock,
}));

vi.mock('../../config/db', () => ({
  db: {
    select: selectMock,
  },
}));

import { sitemapRouter } from './sitemap';

describe('sitemap route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    cachedMock.mockImplementation(async (_key, _ttl, fetcher) => fetcher());

    const wherePostsMock = vi.fn().mockResolvedValue([
      {
        slug: 'post-1',
        updatedAt: new Date('2026-02-18T10:00:00.000Z'),
      },
    ]);
    const whereProjectsMock = vi.fn().mockResolvedValue([
      {
        slug: 'project-1',
        updatedAt: new Date('2026-02-19T10:00:00.000Z'),
      },
    ]);

    selectMock
      .mockImplementationOnce(() => ({
        from: () => ({ where: wherePostsMock }),
      }))
      .mockImplementationOnce(() => ({
        from: () => ({ where: whereProjectsMock }),
      }));
  });

  it('GET /sitemap.xml returns XML with static and dynamic URLs', async () => {
    const app = new Hono();
    app.route('/', sitemapRouter);

    const response = await app.request('/sitemap.xml');
    const xml = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('application/xml');
    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=300'
    );
    expect(cachedMock).toHaveBeenCalledWith('sitemap:xml', 3600, expect.any(Function));

    expect(xml).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(xml).toContain('<loc>https://site.example.com/</loc>');
    expect(xml).toContain('<loc>https://site.example.com/projects</loc>');
    expect(xml).toContain('<loc>https://site.example.com/blog</loc>');
    expect(xml).toContain('<loc>https://site.example.com/contact</loc>');
    // /doc lives under the API public URL — path-based topology: https://example.com/api/doc
    expect(xml).toContain('<loc>https://example.com/api/doc</loc>');
    expect(xml).toContain('<loc>https://site.example.com/blog/post-1</loc>');
    expect(xml).toContain('<loc>https://site.example.com/projects/project-1</loc>');
    // No API URL must appear in page or content URLs — those belong to the site
    expect(xml).not.toContain('<loc>https://example.com/api/blog/');
    expect(xml).not.toContain('<loc>https://example.com/api/projects/');
  });
});
