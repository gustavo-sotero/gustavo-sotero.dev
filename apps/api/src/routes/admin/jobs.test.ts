/**
 * Tests for the admin DLQ monitoring endpoint.
 *
 * Covers:
 *  GET /dlq — returns counts per DLQ queue and totalFailed
 */

import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getJobCountsMock } = vi.hoisted(() => ({
  getJobCountsMock: vi.fn(),
}));

vi.mock('../../lib/queues', () => ({
  telegramDlqQueue: { getJobCounts: getJobCountsMock },
  imageDlqQueue: { getJobCounts: getJobCountsMock },
  enqueueTelegramNotification: vi.fn(),
  enqueueAnalyticsEvent: vi.fn(),
  enqueueImageOptimize: vi.fn(),
}));

import { adminJobsRouter } from './jobs';

function buildApp() {
  const app = new Hono();
  app.route('/admin/jobs', adminJobsRouter);
  return app;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('GET /admin/jobs/dlq', () => {
  it('returns counts for each DLQ queue', async () => {
    getJobCountsMock.mockResolvedValue({ wait: 2, active: 0, failed: 1, delayed: 0, completed: 5 });

    const app = buildApp();
    const res = await app.request('/admin/jobs/dlq');

    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      success: boolean;
      data: { queues: Array<{ name: string; total: number }>; totalFailed: number };
    };
    expect(body.success).toBe(true);
    expect(body.data.queues).toHaveLength(2);

    const telegram = body.data.queues.find((q) => q.name === 'telegram-notifications-dlq');
    expect(telegram).toBeDefined();
    expect(telegram?.total).toBeGreaterThanOrEqual(0);

    const image = body.data.queues.find((q) => q.name === 'image-optimize-dlq');
    expect(image).toBeDefined();
  });

  it('returns totalFailed as sum of all DLQ queue totals', async () => {
    // telegram DLQ: wait=3, active=1, failed=0, delayed=0, completed=0 → total=4
    // image DLQ:    wait=1, active=0, failed=2, delayed=0, completed=0 → total=3
    getJobCountsMock
      .mockResolvedValueOnce({ wait: 3, active: 1, failed: 0, delayed: 0, completed: 0 })
      .mockResolvedValueOnce({ wait: 1, active: 0, failed: 2, delayed: 0, completed: 0 });

    const app = buildApp();
    const res = await app.request('/admin/jobs/dlq');
    const body = (await res.json()) as { data: { totalFailed: number } };

    expect(body.data.totalFailed).toBe(7); // 4 + 3
  });

  it('returns zeros gracefully when queues are empty', async () => {
    getJobCountsMock.mockResolvedValue({ wait: 0, active: 0, failed: 0, delayed: 0, completed: 0 });

    const app = buildApp();
    const res = await app.request('/admin/jobs/dlq');
    const body = (await res.json()) as { data: { totalFailed: number } };

    expect(res.status).toBe(200);
    expect(body.data.totalFailed).toBe(0);
  });

  it('returns 503 when getJobCounts throws (Redis unavailable)', async () => {
    getJobCountsMock.mockRejectedValue(new Error('Redis down'));

    const app = buildApp();
    const res = await app.request('/admin/jobs/dlq');
    const body = (await res.json()) as { success: boolean; error: { code: string } };

    expect(res.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
  });
});
