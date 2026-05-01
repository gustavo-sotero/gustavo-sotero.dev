import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectErrorEnvelope } from '../test/expectErrorEnvelope';

const redisMock = {
  multi: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
};

vi.mock('../config/redis', () => ({
  redis: redisMock,
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('createRateLimit', () => {
  it('allows request when within threshold', async () => {
    const execMock = vi.fn().mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 1],
      [null, 1],
    ]);

    const chain = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: execMock,
    };

    redisMock.multi.mockReturnValue(chain);

    const { createRateLimit } = await import('./rateLimit');
    const app = new Hono();

    app.post(
      '/limited',
      createRateLimit({ maxRequests: 5, windowMs: 60_000, keyPrefix: 'rl:test' }) as never,
      (c) => c.json({ ok: true })
    );

    const response = await app.request('/limited', {
      method: 'POST',
      headers: {
        'x-real-ip': '198.51.100.42',
      },
    });

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(chain.zadd).toHaveBeenCalledTimes(1);
    expect(execMock).toHaveBeenCalledTimes(1);
  });

  it('returns 429 and Retry-After when threshold is exceeded', async () => {
    const execMock = vi.fn().mockResolvedValue([
      [null, 0],
      [null, 1],
      [null, 6],
      [null, 1],
    ]);

    const chain = {
      zremrangebyscore: vi.fn().mockReturnThis(),
      zadd: vi.fn().mockReturnThis(),
      zcard: vi.fn().mockReturnThis(),
      expire: vi.fn().mockReturnThis(),
      exec: execMock,
    };

    redisMock.multi.mockReturnValue(chain);

    const { createRateLimit } = await import('./rateLimit');
    const app = new Hono();

    app.post(
      '/limited',
      createRateLimit({ maxRequests: 5, windowMs: 60_000, keyPrefix: 'rl:test' }) as never,
      (c) => c.json({ ok: true })
    );

    const response = await app.request('/limited', {
      method: 'POST',
      headers: {
        'x-forwarded-for': '203.0.113.9',
      },
    });

    const body = await response.json();
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expectErrorEnvelope(body, 'RATE_LIMITED', 'Too many requests. Please try again later.');
  });
});

describe('getClientIp', () => {
  it('uses rightmost (real client) IP from x-forwarded-for', async () => {
    const { getClientIp } = await import('./rateLimit');

    const app = new Hono();
    app.get('/ip', (c) => {
      const ip = getClientIp(c as never);
      return c.json({ ip });
    });

    const response = await app.request('/ip', {
      headers: {
        'x-forwarded-for': '203.0.113.10, 198.51.100.2',
      },
    });

    const body = (await response.json()) as { ip: string };
    expect(body.ip).toBe('198.51.100.2');
  });

  it('falls back to x-real-ip when x-forwarded-for is absent', async () => {
    const { getClientIp } = await import('./rateLimit');

    const app = new Hono();
    app.get('/ip', (c) => {
      const ip = getClientIp(c as never);
      return c.json({ ip });
    });

    const response = await app.request('/ip', {
      headers: {
        'x-real-ip': '198.51.100.25',
      },
    });

    const body = (await response.json()) as { ip: string };
    expect(body.ip).toBe('198.51.100.25');
  });
});

describe('comment email cooldown', () => {
  it('detects when cooldown key exists', async () => {
    redisMock.get.mockResolvedValueOnce('1');
    const { isCommentEmailInCooldown } = await import('./rateLimit');

    const inCooldown = await isCommentEmailInCooldown('user@example.com');

    expect(inCooldown).toBe(true);
    expect(redisMock.get).toHaveBeenCalledTimes(1);
  });

  it('sets cooldown with expected TTL', async () => {
    redisMock.set.mockResolvedValueOnce('OK');
    const { setCommentEmailCooldown } = await import('./rateLimit');

    await setCommentEmailCooldown('user@example.com', 300);

    expect(redisMock.set).toHaveBeenCalledTimes(1);
    expect(redisMock.set.mock.calls[0]?.[2]).toBe('EX');
    expect(redisMock.set.mock.calls[0]?.[3]).toBe(300);
  });
});

describe('createRateLimit — local in-memory fallback when Redis is unavailable', () => {
  it('allows request via local fallback when Redis throws, blocks at 80 % of configured limit', async () => {
    vi.resetModules();
    // Replace the redis module with one whose exec always rejects (Redis down)
    vi.doMock('../config/redis', () => ({
      redis: {
        multi: vi.fn(() => ({
          zremrangebyscore: vi.fn().mockReturnThis(),
          zadd: vi.fn().mockReturnThis(),
          zcard: vi.fn().mockReturnThis(),
          expire: vi.fn().mockReturnThis(),
          exec: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        })),
        get: vi.fn(),
        set: vi.fn(),
      },
    }));

    const { createRateLimit } = await import('./rateLimit');
    const app = new Hono();
    // maxRequests=5 → localMax = Math.floor(5 * 0.8) = 4
    app.post(
      '/limited',
      createRateLimit({ maxRequests: 5, windowMs: 60_000, keyPrefix: 'rl:fb' }) as never,
      (c) => c.json({ ok: true })
    );

    const opts = { method: 'POST' as const, headers: { 'x-forwarded-for': '198.51.100.99' } };

    // First 4 should pass (within localMax)
    for (let i = 0; i < 4; i++) {
      const r = await app.request('/limited', opts);
      expect(r.status).toBe(200);
    }

    // 5th exceeds local limit → 429
    const blocked = await app.request('/limited', opts);
    const body = await blocked.json();
    expect(blocked.status).toBe(429);
    expect(blocked.headers.get('Retry-After')).toBe('60');
    expect(body).toMatchObject({ success: false, error: { code: 'RATE_LIMITED' } });

    vi.resetModules();
  });
});

describe('comment email cooldown — Redis fallback', () => {
  it('falls back to local store on Redis failure; set → read roundtrip works', async () => {
    vi.resetModules();
    vi.doMock('../config/redis', () => ({
      redis: {
        multi: vi.fn(),
        get: vi.fn().mockRejectedValue(new Error('Redis down')),
        set: vi.fn().mockRejectedValue(new Error('Redis down')),
      },
    }));

    const { isCommentEmailInCooldown, setCommentEmailCooldown } = await import('./rateLimit');

    // No cooldown in local store yet — should return false
    expect(await isCommentEmailInCooldown('a@example.com')).toBe(false);

    // Write to local store (Redis fails → local fallback)
    await setCommentEmailCooldown('a@example.com', 300);

    // Read from local store (Redis fails → local fallback, finds the entry)
    expect(await isCommentEmailInCooldown('a@example.com')).toBe(true);

    vi.resetModules();
  });
});

describe('createRateLimit — RATE_LIMIT_LOCAL_FALLBACK=false returns 503 when Redis is unavailable', () => {
  it('returns 503 SERVICE_UNAVAILABLE when Redis throws and fallback is disabled', async () => {
    vi.resetModules();

    vi.doMock('../config/redis', () => ({
      redis: {
        multi: vi.fn(() => ({
          zremrangebyscore: vi.fn().mockReturnThis(),
          zadd: vi.fn().mockReturnThis(),
          zcard: vi.fn().mockReturnThis(),
          expire: vi.fn().mockReturnThis(),
          exec: vi.fn().mockRejectedValue(new Error('ECONNREFUSED')),
        })),
        get: vi.fn(),
        set: vi.fn(),
      },
    }));

    // Override env so RATE_LIMIT_LOCAL_FALLBACK is false — no local fallback allowed
    vi.doMock('../config/env', () => ({
      env: { RATE_LIMIT_LOCAL_FALLBACK: false },
    }));

    const { createRateLimit } = await import('./rateLimit');
    const app = new Hono();
    app.post(
      '/limited',
      createRateLimit({ maxRequests: 5, windowMs: 60_000, keyPrefix: 'rl:nofall' }) as never,
      (c) => c.json({ ok: true })
    );

    const response = await app.request('/limited', {
      method: 'POST',
      headers: { 'x-forwarded-for': '198.51.100.50' },
    });

    const body = await response.json();
    expect(response.status).toBe(503);
    expect(body).toMatchObject({
      success: false,
      error: { code: 'SERVICE_UNAVAILABLE' },
    });

    vi.resetModules();
  });
});
