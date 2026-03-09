import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';

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
    expect(body).toEqual({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'Too many requests. Please try again later.',
      },
    });
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
