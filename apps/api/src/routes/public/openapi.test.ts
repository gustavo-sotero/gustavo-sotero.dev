import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { openApiRouter } from './openapi';

describe('openapi routes', () => {
  it('GET /doc/spec returns OpenAPI 3.1 JSON with cache header', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      openapi: string;
      info: { title: string };
      paths: Record<string, unknown>;
    };

    expect(response.status).toBe(200);
    expect(response.headers.get('cache-control')).toBe(
      'public, s-maxage=3600, stale-while-revalidate=300'
    );
    expect(body.openapi).toBe('3.1.0');
    expect(body.info.title).toBe('Portfolio API');
    expect(body.paths).toHaveProperty('/posts');
    expect(body.paths).toHaveProperty('/projects');
    expect(body.paths).toHaveProperty('/auth/github/start');
  });

  it('GET /doc returns Swagger UI HTML', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc');
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/html');
    expect(html).toContain('SwaggerUIBundle');
    expect(html).toContain('https://example.com/api/doc/spec');
  });

  it('GET /doc/spec exposes the path-based API server as the default server URL', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      servers: Array<{
        variables?: {
          apiUrl?: {
            default?: string;
          };
        };
      }>;
    };

    expect(body.servers[0]?.variables?.apiUrl?.default).toBe('https://example.com/api');
  });

  it('GET /doc/spec includes all Module 8 route contracts', async () => {
    const app = new Hono();
    app.route('/', openApiRouter);

    const response = await app.request('/doc/spec');
    const body = (await response.json()) as {
      paths: Record<string, unknown>;
    };

    const expectedPaths = [
      '/health',
      '/ready',
      '/posts',
      '/posts/{slug}',
      '/projects',
      '/projects/{slug}',
      '/comments',
      '/contact',
      '/tags',
      '/feed.xml',
      '/sitemap.xml',
      '/doc/spec',
      '/doc',
      '/auth/github/start',
      '/auth/github/callback',
      '/auth/logout',
      '/admin/posts',
      '/admin/posts/{id}',
      '/admin/projects',
      '/admin/projects/{id}',
      '/admin/tags',
      '/admin/tags/{id}',
      '/admin/comments',
      '/admin/comments/reply',
      '/admin/comments/{id}/approve',
      '/admin/comments/{id}/reject',
      '/admin/comments/{id}/status',
      '/admin/comments/{id}/content',
      '/admin/comments/{id}',
      '/admin/contacts',
      '/admin/contacts/{id}/read',
      '/admin/uploads/presign',
      '/admin/uploads/{id}/confirm',
      '/admin/uploads/{id}',
      '/admin/analytics/summary',
      '/admin/analytics/top-posts',
      '/experience',
      '/experience/{slug}',
      '/education',
      '/education/{slug}',
      '/admin/experience',
      '/admin/experience/{id}',
      '/admin/education',
      '/admin/education/{id}',
      '/admin/jobs/dlq',
      '/developer/profile',
    ];

    for (const path of expectedPaths) {
      expect(body.paths).toHaveProperty(path);
    }
  });
});
