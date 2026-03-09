/**
 * Tests for the analytics middleware.
 *
 * Covers:
 *  - Enqueues analytics event for tracked public GET routes
 *  - Excludes /health, /ready, /feed.xml, /sitemap.xml, /doc, /doc/spec
 *  - Does not enqueue for non-GET methods
 *  - Does not enqueue for /admin prefixed paths
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enqueueAnalyticsEventMock } = vi.hoisted(() => ({
  enqueueAnalyticsEventMock: vi.fn(),
}));

vi.mock('../lib/queues', () => ({
  enqueueAnalyticsEvent: enqueueAnalyticsEventMock,
  enqueueTelegramNotification: vi.fn(),
  enqueueImageOptimize: vi.fn(),
}));

vi.mock('../middleware/rateLimit', () => ({
  getClientIp: () => '198.51.100.1',
  createRateLimit: vi.fn(() => vi.fn()),
}));

import { analyticsMiddleware } from './analytics';

function buildApp(...paths: string[]) {
  const app = new Hono();
  // Apply analytics middleware globally
  app.use('*', analyticsMiddleware);
  for (const p of paths) {
    app.get(p, (c) => c.json({ ok: true }));
    app.post(p, (c) => c.json({ ok: true }));
  }
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('analyticsMiddleware', () => {
  it('enqueues event for tracked public GET', async () => {
    const app = buildApp('/posts');
    await app.request('/posts', { method: 'GET' });
    expect(enqueueAnalyticsEventMock).toHaveBeenCalledTimes(1);
    const firstCall = enqueueAnalyticsEventMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toMatchObject({
      path: '/posts',
      method: 'GET',
    });
  });

  it('does NOT enqueue for POST requests', async () => {
    const app = buildApp('/posts');
    await app.request('/posts', {
      method: 'POST',
      body: '{}',
      headers: { 'Content-Type': 'application/json' },
    });
    expect(enqueueAnalyticsEventMock).not.toHaveBeenCalled();
  });

  describe('excluded paths', () => {
    const excludedPaths = ['/health', '/ready', '/feed.xml', '/sitemap.xml', '/doc', '/doc/spec'];

    for (const p of excludedPaths) {
      it(`does NOT enqueue for ${p}`, async () => {
        const app = buildApp(p);
        await app.request(p, { method: 'GET' });
        expect(enqueueAnalyticsEventMock).not.toHaveBeenCalled();
      });
    }

    it('does NOT enqueue for /doc/ sub-paths', async () => {
      const app = buildApp('/doc/anything');
      await app.request('/doc/anything', { method: 'GET' });
      expect(enqueueAnalyticsEventMock).not.toHaveBeenCalled();
    });
  });

  it('does NOT enqueue for /admin paths', async () => {
    const app = buildApp('/admin/posts');
    await app.request('/admin/posts', { method: 'GET' });
    expect(enqueueAnalyticsEventMock).not.toHaveBeenCalled();
  });

  it('includes cf-ipcountry header as country if present', async () => {
    const app = buildApp('/projects');
    await app.request('/projects', {
      method: 'GET',
      headers: { 'cf-ipcountry': 'BR' },
    });
    expect(enqueueAnalyticsEventMock).toHaveBeenCalledTimes(1);
    const firstCall = enqueueAnalyticsEventMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]).toMatchObject({ country: 'BR' });
  });

  it('sets country to null if cf-ipcountry header is absent', async () => {
    const app = buildApp('/projects');
    await app.request('/projects', { method: 'GET' });
    expect(enqueueAnalyticsEventMock).toHaveBeenCalledTimes(1);
    const firstCall = enqueueAnalyticsEventMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    expect(firstCall?.[0]?.country).toBeNull();
  });
});
