import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { expectErrorEnvelope } from '../../test/expectErrorEnvelope';

type OAuthStartResponse = {
  success: boolean;
  data: {
    authUrl: string;
  };
};

const { redisMock, signMock, verifyMock } = vi.hoisted(() => ({
  redisMock: {
    set: vi.fn(),
    get: vi.fn(),
    getdel: vi.fn(),
    eval: vi.fn(),
    del: vi.fn(),
    multi: vi.fn(),
  },
  signMock: vi.fn(),
  verifyMock: vi.fn(),
}));

vi.mock('../../config/env', () => ({
  env: {
    GITHUB_CLIENT_ID: 'github-client-id',
    GITHUB_CLIENT_SECRET: 'github-client-secret',
    // Path-based production format: https://example.com/api/auth/github/callback
    // The proxy strips /api, so the backend internally receives /auth/github/callback.
    GITHUB_CALLBACK_URL: 'https://example.com/api/auth/github/callback',
    ADMIN_GITHUB_ID: '12345',
    JWT_SECRET: '12345678901234567890123456789012',
    ALLOWED_ORIGIN: 'https://example.com',
    NODE_ENV: 'test',
  },
}));

vi.mock('../../config/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('../../config/redis', () => ({
  redis: redisMock,
}));

vi.mock('../../middleware/rateLimit', () => ({
  createRateLimit: () => async (_c: unknown, next: () => Promise<void>) => next(),
}));

vi.mock('../../middleware/auth', () => ({
  authAdmin: async (
    c: { req: { header: (name: string) => string | undefined }; res?: Response },
    next: () => Promise<void>
  ) => {
    const cookie = c.req.header('cookie') ?? '';
    if (!cookie.includes('admin_token=valid-session')) {
      c.res = new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'UNAUTHORIZED',
            message: 'Authentication required',
          },
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      return;
    }

    await next();
  },
}));

vi.mock('../../middleware/csrf', () => ({
  csrfProtection: async (
    c: { req: { header: (name: string) => string | undefined }; res?: Response },
    next: () => Promise<void>
  ) => {
    const cookie = c.req.header('cookie') ?? '';
    const csrfHeader = c.req.header('x-csrf-token') ?? '';

    if (!cookie.includes(`csrf_token=${csrfHeader}`) || !csrfHeader) {
      c.res = new Response(
        JSON.stringify({
          success: false,
          error: {
            code: 'FORBIDDEN',
            message: 'Invalid CSRF token',
          },
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' },
        }
      );
      return;
    }

    await next();
  },
}));

vi.mock('hono/jwt', () => ({
  sign: signMock,
  verify: verifyMock,
}));

import { authRouter } from './auth';

describe('auth routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    redisMock.multi.mockImplementation(() => {
      const chain = {
        zremrangebyscore: vi.fn(() => chain),
        zadd: vi.fn(() => chain),
        zcard: vi.fn(() => chain),
        expire: vi.fn(() => chain),
        exec: vi.fn(async () => [
          [null, 0],
          [null, 1],
          [null, 1],
          [null, 1],
        ]),
      };
      return chain;
    });

    verifyMock.mockImplementation(async (token: string) => {
      if (token === 'valid-session') {
        return {
          sub: '12345',
          role: 'admin',
          exp: Math.floor(Date.now() / 1000) + 3600,
          iat: Math.floor(Date.now() / 1000),
        };
      }

      throw new Error('invalid token');
    });
  });

  it('POST /github/start stores OAuth state and returns GitHub auth URL', async () => {
    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/github/start', {
      method: 'POST',
    });

    const body = (await response.json()) as OAuthStartResponse;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data.authUrl).toBe('string');
    expect(body.data.authUrl).toContain('https://github.com/login/oauth/authorize?');
    expect(redisMock.set).toHaveBeenCalledTimes(1);
  });

  it('POST /github/start falls back to local state store when Redis is unavailable', async () => {
    redisMock.set.mockRejectedValueOnce(new Error('redis down'));

    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/github/start', {
      method: 'POST',
    });
    const body = (await response.json()) as OAuthStartResponse;

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(typeof body.data.authUrl).toBe('string');
  });

  it('GET /github/callback consumes local fallback state when Redis is unavailable', async () => {
    redisMock.set.mockRejectedValueOnce(new Error('redis down'));
    redisMock.getdel.mockRejectedValueOnce(new Error('redis down'));
    signMock.mockResolvedValueOnce('signed-jwt-token');

    const startApp = new Hono();
    startApp.route('/auth', authRouter);
    const startRes = await startApp.request('/auth/github/start', { method: 'POST' });
    const startBody = (await startRes.json()) as OAuthStartResponse;

    const authUrl = new URL(startBody.data.authUrl);
    const state = authUrl.searchParams.get('state');
    expect(state).toBeTruthy();

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'github-access-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 12345, login: 'admin-user' }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const callbackApp = new Hono();
    callbackApp.route('/auth', authRouter);

    const callbackRes = await callbackApp.request(
      `/auth/github/callback?code=code-123&state=${state}`,
      {
        redirect: 'manual',
      }
    );

    expect(callbackRes.status).toBe(302);
    expect(callbackRes.headers.get('location')).toBe('https://example.com/admin');
  });

  it('GET /github/callback returns 400 when code or state is missing', async () => {
    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/github/callback');
    const body = await response.json();

    expect(response.status).toBe(400);
    expectErrorEnvelope(body, 'VALIDATION_ERROR', 'Missing code or state parameter');
  });

  it('GET /github/callback returns 403 when OAuth state is invalid/expired', async () => {
    redisMock.getdel.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/github/callback?code=code-123&state=state-123');
    const body = await response.json();

    expect(response.status).toBe(403);
    expectErrorEnvelope(body, 'FORBIDDEN', 'Invalid or expired state');
  });

  it('GET /github/callback falls back to Lua when GETDEL is unavailable', async () => {
    redisMock.getdel.mockRejectedValueOnce(new Error('ERR unknown command `GETDEL`'));
    redisMock.eval.mockResolvedValueOnce(null);

    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/github/callback?code=code-123&state=state-123');
    const body = await response.json();

    expect(response.status).toBe(403);
    expectErrorEnvelope(body, 'FORBIDDEN', 'Invalid or expired state');
    expect(redisMock.eval).toHaveBeenCalledTimes(1);
  });

  it('GET /github/callback returns 403 when state is unavailable after Redis failure', async () => {
    redisMock.getdel.mockRejectedValueOnce(new Error('redis down'));

    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/github/callback?code=code-123&state=state-123');
    const body = await response.json();

    expect(response.status).toBe(403);
    expectErrorEnvelope(body, 'FORBIDDEN', 'Invalid or expired state');
  });

  it('GET /github/callback returns 403 when Redis consume fails and no local fallback exists', async () => {
    redisMock.getdel.mockRejectedValueOnce(new Error('redis down'));

    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/github/callback?code=code-123&state=state-123');
    const body = await response.json();

    expect(response.status).toBe(403);
    expectErrorEnvelope(body, 'FORBIDDEN', 'Invalid or expired state');
  });

  it('GET /github/callback returns 403 when GitHub user is not the configured admin', async () => {
    redisMock.getdel.mockResolvedValueOnce('1');

    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'github-access-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 99999, login: 'other-user' }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/github/callback?code=code-123&state=state-123');
    const body = await response.json();

    expect(response.status).toBe(403);
    expectErrorEnvelope(body, 'FORBIDDEN', 'User not authorized');
    expect(redisMock.getdel).toHaveBeenCalledWith('oauth:state:state-123');
  });

  it('GET /github/callback returns 503 when token exchange times out', async () => {
    redisMock.getdel.mockResolvedValueOnce('1');

    const timeoutError = new Error('Operation timed out');
    timeoutError.name = 'TimeoutError';

    const fetchMock = vi.fn().mockRejectedValueOnce(timeoutError);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/github/callback?code=code-123&state=state-123');
    const body = await response.json();

    expect(response.status).toBe(503);
    expectErrorEnvelope(body, 'SERVICE_UNAVAILABLE', 'Failed to exchange GitHub OAuth code');
  });

  it('GET /github/callback returns 503 when profile fetch is aborted', async () => {
    redisMock.getdel.mockResolvedValueOnce('1');

    const abortError = new Error('The operation was aborted');
    abortError.name = 'AbortError';

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'github-access-token' }),
      })
      .mockRejectedValueOnce(abortError);
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/github/callback?code=code-123&state=state-123');
    const body = await response.json();

    expect(response.status).toBe(503);
    expectErrorEnvelope(body, 'SERVICE_UNAVAILABLE', 'Failed to fetch GitHub profile');
  });

  it('GET /github/callback issues admin and csrf cookies and redirects on success', async () => {
    redisMock.getdel.mockResolvedValueOnce('1');
    signMock.mockResolvedValueOnce('signed-jwt-token');

    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'github-access-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 12345, login: 'admin-user' }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/github/callback?code=code-123&state=state-123', {
      redirect: 'manual',
    });

    expect(response.status).toBe(302);
    expect(response.headers.get('location')).toBe('https://example.com/admin');

    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toContain('admin_token=signed-jwt-token');
    expect(setCookieHeader).toContain('HttpOnly');
    expect(setCookieHeader).toContain('SameSite=Strict');
    expect(setCookieHeader).toContain('csrf_token=');
    expect(setCookieHeader).toContain('Max-Age=86400');
  });

  it('GET /github/callback enforces single-use state token', async () => {
    redisMock.getdel.mockResolvedValueOnce('1').mockResolvedValueOnce(null);
    signMock.mockResolvedValueOnce('signed-jwt-token');

    const fetchMock = vi.fn();
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ access_token: 'github-access-token' }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ id: 12345, login: 'admin-user' }),
      });
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const app = new Hono();
    app.route('/auth', authRouter);

    const first = await app.request('/auth/github/callback?code=code-123&state=state-123', {
      redirect: 'manual',
    });
    const second = await app.request('/auth/github/callback?code=code-123&state=state-123');
    const secondBody = await second.json();

    expect(first.status).toBe(302);
    expect(second.status).toBe(403);
    expectErrorEnvelope(secondBody, 'FORBIDDEN', 'Invalid or expired state');
    expect(redisMock.getdel).toHaveBeenCalledTimes(2);
  });

  it('POST /logout returns 401 when admin session is missing', async () => {
    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/logout', {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-token',
        cookie: 'csrf_token=csrf-token',
      },
    });

    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  });

  it('POST /logout succeeds with valid session and CSRF token', async () => {
    const app = new Hono();
    app.route('/auth', authRouter);

    const response = await app.request('/auth/logout', {
      method: 'POST',
      headers: {
        'x-csrf-token': 'csrf-token',
        cookie: 'admin_token=valid-session; csrf_token=csrf-token',
      },
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      success: true,
      data: {
        message: 'Logged out',
      },
    });

    const setCookieHeader = response.headers.get('set-cookie');
    expect(setCookieHeader).toContain('admin_token=');
  });
});
