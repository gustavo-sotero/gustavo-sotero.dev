import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { cacheControlMiddleware } from './cacheControl';

function buildApp(path: string) {
  const app = new Hono();
  app.use('*', cacheControlMiddleware);
  app.get(path, (c) => c.json({ ok: true }));
  return app;
}

describe('cacheControlMiddleware', () => {
  it('sets no-store for admin routes', async () => {
    const app = buildApp('/admin/posts');
    const response = await app.request('/admin/posts');

    expect(response.headers.get('cache-control')).toBe('no-store, private');
  });

  it('sets no-store for auth routes', async () => {
    const app = buildApp('/auth/github/start');
    const response = await app.request('/auth/github/start');

    expect(response.headers.get('cache-control')).toBe('no-store, private');
  });

  it('sets listing cache policy for public collection routes', async () => {
    const app = buildApp('/posts');
    const response = await app.request('/posts');

    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=300, stale-while-revalidate=60'
    );
  });

  it('sets detail cache policy for public slug routes', async () => {
    const app = buildApp('/projects/meu-projeto');
    const response = await app.request('/projects/meu-projeto');

    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=300'
    );
  });

  it('does not override feed/sitemap cache headers', async () => {
    const app = new Hono();
    app.use('*', cacheControlMiddleware);
    app.get('/feed.xml', (c) => {
      c.header('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
      return c.body('ok');
    });
    app.get('/sitemap.xml', (c) => {
      c.header('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=300');
      return c.body('ok');
    });

    const feedResponse = await app.request('/feed.xml');
    const sitemapResponse = await app.request('/sitemap.xml');

    expect(feedResponse.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=300'
    );
    expect(sitemapResponse.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=300'
    );
  });
});
