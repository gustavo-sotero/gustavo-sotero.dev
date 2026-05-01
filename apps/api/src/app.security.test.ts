import type { MiddlewareHandler } from 'hono';
import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectErrorEnvelope } from './test/expectErrorEnvelope';

const { passThrough, verifyMock } = vi.hoisted(() => ({
  passThrough: (async (_c: unknown, next: () => Promise<void>) => {
    await next();
  }) as MiddlewareHandler,
  verifyMock: vi.fn(),
}));

function makeRouter(
  definitions: Array<{ method: 'get' | 'post' | 'put' | 'patch' | 'delete'; path: string }>
) {
  const router = new Hono();

  for (const route of definitions) {
    router[route.method](route.path, (c) => c.json({ success: true, data: { route: route.path } }));
  }

  return router;
}

function emptyRouter() {
  return new Hono();
}

vi.mock('@logtape/hono', () => ({
  honoLogger: vi.fn(() => passThrough),
}));

vi.mock('./config/logger', () => ({
  getLogger: () => ({
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('./config/env', () => ({
  env: {
    BODY_SIZE_LIMIT: 1_048_576,
    ALLOWED_ORIGIN: 'https://web.example.com',
    S3_PUBLIC_DOMAIN: 'https://cdn.example.com',
    API_PUBLIC_URL: 'https://example.com/api',
    JWT_SECRET: '12345678901234567890123456789012',
    ADMIN_GITHUB_ID: '12345',
  },
}));

vi.mock('hono/jwt', () => ({
  verify: verifyMock,
}));

vi.mock('./middleware/requestId', () => ({ requestId: passThrough }));
vi.mock('./middleware/analytics', () => ({ analyticsMiddleware: passThrough }));
vi.mock('./middleware/cacheControl', () => ({ cacheControlMiddleware: passThrough }));
vi.mock('./middleware/errorHandler', () => ({
  globalErrorHandler: (err: Error, c: { json: (body: unknown, status?: number) => unknown }) =>
    c.json({ success: false, error: { code: 'INTERNAL_ERROR', message: err.message } }, 500),
}));

vi.mock('./routes/public/health', () => ({ healthRouter: emptyRouter() }));
vi.mock('./routes/public/feed', () => ({ feedRouter: emptyRouter() }));
vi.mock('./routes/public/sitemap', () => ({ sitemapRouter: emptyRouter() }));
vi.mock('./routes/public/openapi', () => ({ openApiRouter: emptyRouter() }));
vi.mock('./routes/public/comments', () => ({ commentsRouter: emptyRouter() }));
vi.mock('./routes/public/contact', () => ({ contactRouter: emptyRouter() }));
vi.mock('./routes/public/developer', () => ({ publicDeveloperRouter: emptyRouter() }));
vi.mock('./routes/public/education', () => ({ publicEducationRouter: emptyRouter() }));
vi.mock('./routes/public/experience', () => ({ publicExperienceRouter: emptyRouter() }));
vi.mock('./routes/public/home', () => ({ publicHomeRouter: emptyRouter() }));
vi.mock('./routes/public/posts', () => ({ publicPostsRouter: emptyRouter() }));
vi.mock('./routes/public/projects', () => ({ publicProjectsRouter: emptyRouter() }));
vi.mock('./routes/public/skills', () => ({ publicSkillsRouter: emptyRouter() }));
vi.mock('./routes/public/tags', () => ({ publicTagsRouter: emptyRouter() }));
vi.mock('./routes/admin/auth', () => ({ authRouter: emptyRouter() }));
vi.mock('./routes/admin/posts', () => ({ adminPostsRouter: emptyRouter() }));
vi.mock('./routes/admin/projects', () => ({ adminProjectsRouter: emptyRouter() }));
vi.mock('./routes/admin/skills', () => ({ adminSkillsRouter: emptyRouter() }));
vi.mock('./routes/admin/tags', () => ({ adminTagsRouter: emptyRouter() }));
vi.mock('./routes/admin/uploads', () => ({ adminUploadsRouter: emptyRouter() }));
vi.mock('./routes/admin/comments', () => ({ adminCommentsRouter: emptyRouter() }));
vi.mock('./routes/admin/contacts', () => ({ adminContactsRouter: emptyRouter() }));
vi.mock('./routes/admin/experience', () => ({ adminExperienceRouter: emptyRouter() }));
vi.mock('./routes/admin/education', () => ({ adminEducationRouter: emptyRouter() }));
vi.mock('./routes/admin/analytics', () => ({ adminAnalyticsRouter: emptyRouter() }));
vi.mock('./routes/admin/jobs', () => ({ adminJobsRouter: emptyRouter() }));
vi.mock('./routes/admin/post-generation', () => ({
  adminPostGenerationRouter: makeRouter([
    { method: 'get', path: '/config' },
    { method: 'put', path: '/config' },
  ]),
}));

import { app } from './app';

describe('app admin security envelope', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects PUT /admin/posts/generate/config when the admin session cookie is missing', async () => {
    const response = await app.request('/admin/posts/generate/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'csrf_token=csrf-token',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({ topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' }),
    });

    const body = await response.json();

    expect(response.status).toBe(401);
    expectErrorEnvelope(body, 'UNAUTHORIZED', 'Authentication required');
    expect(verifyMock).not.toHaveBeenCalled();
  });

  it('rejects PUT /admin/posts/generate/config when CSRF is missing after a valid admin session', async () => {
    verifyMock.mockResolvedValueOnce({
      sub: '12345',
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });

    const response = await app.request('/admin/posts/generate/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'admin_token=valid-token; csrf_token=csrf-token',
      },
      body: JSON.stringify({ topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' }),
    });

    const body = await response.json();

    expect(response.status).toBe(403);
    expectErrorEnvelope(body, 'FORBIDDEN', 'Invalid CSRF token');
    expect(verifyMock).toHaveBeenCalledTimes(1);
  });

  it('allows PUT /admin/posts/generate/config when auth and CSRF both pass through app.ts', async () => {
    verifyMock.mockResolvedValueOnce({
      sub: '12345',
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });

    const response = await app.request('/admin/posts/generate/config', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        cookie: 'admin_token=valid-token; csrf_token=csrf-token',
        'x-csrf-token': 'csrf-token',
      },
      body: JSON.stringify({ topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' }),
    });

    const body = (await response.json()) as { success?: boolean; data?: { route?: string } };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data?.route).toBe('/config');
    expect(verifyMock).toHaveBeenCalledTimes(1);
  });
});
