import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeMock, pingMock, verifyRequiredSchemaMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
  pingMock: vi.fn(),
  verifyRequiredSchemaMock: vi.fn(),
}));

vi.mock('../../config/db', () => ({
  db: {
    execute: executeMock,
  },
}));

vi.mock('../../config/redis', () => ({
  redis: {
    ping: pingMock,
  },
}));

vi.mock('../../db/verify-schema', () => ({
  verifyRequiredSchema: verifyRequiredSchemaMock,
}));

import { healthRouter } from './health';

describe('health routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    verifyRequiredSchemaMock.mockResolvedValue({ ok: true, missing: [] });
  });

  it('GET /health returns liveness payload', async () => {
    const app = new Hono();
    app.route('/', healthRouter);

    const response = await app.request('/health');
    const body = (await response.json()) as {
      success: boolean;
      data: { status: string; uptime: number; timestamp: string };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data.status).toBe('ok');
    expect(typeof body.data.uptime).toBe('number');
    expect(typeof body.data.timestamp).toBe('string');
  });

  it('GET /ready returns readiness success when db, redis and schema are healthy', async () => {
    executeMock.mockResolvedValueOnce([{ '?column?': 1 }]);
    pingMock.mockResolvedValueOnce('PONG');

    const app = new Hono();
    app.route('/', healthRouter);

    const response = await app.request('/ready');
    const body = (await response.json()) as {
      success: boolean;
      data: { db: string; redis: string; schema: string };
    };

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toEqual({ db: 'ok', redis: 'ok', schema: 'ok' });
  });

  it('GET /ready returns SERVICE_UNAVAILABLE when db fails', async () => {
    executeMock.mockRejectedValueOnce(new Error('db down'));
    pingMock.mockResolvedValueOnce('PONG');

    const app = new Hono();
    app.route('/', healthRouter);

    const response = await app.request('/ready');
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string; details?: Array<{ field: string }> };
    };

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.error.details?.some((detail) => detail.field === 'db')).toBe(true);
  });

  it('GET /ready returns SERVICE_UNAVAILABLE when schema parity check fails', async () => {
    executeMock.mockResolvedValueOnce([{ '?column?': 1 }]);
    pingMock.mockResolvedValueOnce('PONG');
    verifyRequiredSchemaMock.mockResolvedValueOnce({
      ok: false,
      missing: ['table:skills'],
    });

    const app = new Hono();
    app.route('/', healthRouter);

    const response = await app.request('/ready');
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; details?: Array<{ field: string }> };
    };

    expect(response.status).toBe(503);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(body.error.details?.some((detail) => detail.field === 'db-schema')).toBe(true);
  });
});
