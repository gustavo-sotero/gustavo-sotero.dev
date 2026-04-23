import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';

const { passThrough } = vi.hoisted(() => ({
  passThrough: (async (_c, next) => {
    await next();
  }) as Parameters<Hono['use']>[1],
}));

vi.mock('./config/env', () => ({
  env: {
    BODY_SIZE_LIMIT: 1_048_576,
    ALLOWED_ORIGIN: 'https://web.example.com',
    S3_PUBLIC_DOMAIN: 'https://cdn.example.com',
    // Uses the official path-based topology (https://example.com/api) as primary fixture.
    API_PUBLIC_URL: 'https://example.com/api',
  },
}));

vi.mock('./middleware/requestId', () => ({ requestId: passThrough }));
vi.mock('./middleware/analytics', () => ({ analyticsMiddleware: passThrough }));
vi.mock('./middleware/cacheControl', () => ({ cacheControlMiddleware: passThrough }));
vi.mock('./middleware/auth', () => ({ authAdmin: passThrough }));
vi.mock('./middleware/csrf', () => ({ csrfProtection: passThrough }));
vi.mock('./middleware/errorHandler', () => ({
  globalErrorHandler: (err: Error, c: { json: (body: unknown, status?: number) => unknown }) =>
    c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500),
}));

function makeRouter(
  definitions: Array<{ method: 'get' | 'post' | 'patch' | 'delete'; path: string }>
) {
  const router = new Hono();

  for (const route of definitions) {
    router[route.method](route.path, (c) => c.json({ success: true, data: { route: route.path } }));
  }

  return router;
}

vi.mock('./routes/public/health', () => ({
  healthRouter: makeRouter([
    { method: 'get', path: '/health' },
    { method: 'get', path: '/ready' },
  ]),
}));
vi.mock('./routes/public/feed', () => ({
  feedRouter: makeRouter([{ method: 'get', path: '/feed.xml' }]),
}));
vi.mock('./routes/public/sitemap', () => ({
  sitemapRouter: makeRouter([{ method: 'get', path: '/sitemap.xml' }]),
}));
vi.mock('./routes/public/openapi', () => ({
  openApiRouter: makeRouter([
    { method: 'get', path: '/doc' },
    { method: 'get', path: '/doc/spec' },
  ]),
}));
vi.mock('./routes/public/posts', () => ({
  publicPostsRouter: makeRouter([
    { method: 'get', path: '/' },
    { method: 'get', path: '/:slug' },
  ]),
}));
vi.mock('./routes/public/projects', () => ({
  publicProjectsRouter: makeRouter([
    { method: 'get', path: '/' },
    { method: 'get', path: '/:slug' },
  ]),
}));
vi.mock('./routes/public/tags', () => ({
  publicTagsRouter: makeRouter([{ method: 'get', path: '/' }]),
}));
vi.mock('./routes/public/developer', () => ({
  publicDeveloperRouter: makeRouter([{ method: 'get', path: '/profile' }]),
}));
vi.mock('./routes/public/comments', () => ({
  commentsRouter: makeRouter([{ method: 'post', path: '/' }]),
}));
vi.mock('./routes/public/contact', () => ({
  contactRouter: makeRouter([{ method: 'post', path: '/' }]),
}));

vi.mock('./routes/public/skills', () => ({
  publicSkillsRouter: makeRouter([{ method: 'get', path: '/' }]),
}));

vi.mock('./routes/admin/auth', () => ({
  authRouter: makeRouter([
    { method: 'post', path: '/github/start' },
    { method: 'get', path: '/github/callback' },
    { method: 'post', path: '/logout' },
  ]),
}));
vi.mock('./routes/admin/posts', () => ({
  adminPostsRouter: makeRouter([
    { method: 'get', path: '/' },
    { method: 'post', path: '/' },
    { method: 'patch', path: '/:id' },
    { method: 'delete', path: '/:id' },
  ]),
}));
vi.mock('./routes/admin/projects', () => ({
  adminProjectsRouter: makeRouter([{ method: 'get', path: '/' }]),
}));
vi.mock('./routes/admin/tags', () => ({
  adminTagsRouter: makeRouter([{ method: 'get', path: '/' }]),
}));
vi.mock('./routes/admin/uploads', () => ({
  adminUploadsRouter: makeRouter([{ method: 'post', path: '/presign' }]),
}));
vi.mock('./routes/admin/comments', () => ({
  adminCommentsRouter: makeRouter([{ method: 'get', path: '/' }]),
}));
vi.mock('./routes/admin/contacts', () => ({
  adminContactsRouter: makeRouter([{ method: 'get', path: '/' }]),
}));
vi.mock('./routes/admin/analytics', () => ({
  adminAnalyticsRouter: makeRouter([{ method: 'get', path: '/summary' }]),
}));
vi.mock('./routes/admin/jobs', () => ({
  adminJobsRouter: makeRouter([{ method: 'get', path: '/dlq' }]),
}));

vi.mock('./routes/admin/skills', () => ({
  adminSkillsRouter: makeRouter([
    { method: 'get', path: '/' },
    { method: 'post', path: '/' },
    { method: 'patch', path: '/:id' },
    { method: 'delete', path: '/:id' },
  ]),
}));

import { app } from './app';

describe('app route mounting (module 8 smoke)', () => {
  it('exposes all public and admin paths expected by Module 8', async () => {
    const checks: Array<{ method?: string; path: string }> = [
      { path: '/health' },
      { path: '/ready' },
      { path: '/posts' },
      { path: '/posts/my-post' },
      { path: '/projects' },
      { path: '/projects/my-project' },
      { method: 'POST', path: '/comments' },
      { method: 'POST', path: '/contact' },
      { path: '/tags' },
      { path: '/developer/profile' },
      { path: '/feed.xml' },
      { path: '/sitemap.xml' },
      { path: '/doc/spec' },
      { path: '/doc' },
      { method: 'POST', path: '/auth/github/start' },
      { path: '/auth/github/callback' },
      { method: 'POST', path: '/auth/logout' },
      { path: '/admin/posts' },
      { method: 'POST', path: '/admin/posts' },
      { path: '/admin/projects' },
      { path: '/admin/tags' },
      { path: '/admin/comments' },
      { path: '/admin/contacts' },
      { method: 'POST', path: '/admin/uploads/presign' },
      { path: '/admin/analytics/summary' },
      { path: '/admin/jobs/dlq' },
      { path: '/skills' },
      { path: '/admin/skills' },
      { method: 'POST', path: '/admin/skills' },
    ];

    for (const check of checks) {
      const response = await app.request(check.path, { method: check.method ?? 'GET' });
      const body = (await response.json()) as { success?: boolean; data?: unknown };

      expect(response.status).toBe(200);
      expect(body.success).toBe(true);
      expect(body.data).toBeDefined();
    }
  });
});
