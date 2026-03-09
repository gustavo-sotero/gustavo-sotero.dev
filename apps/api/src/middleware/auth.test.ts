import { Hono } from 'hono';
import { describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../types/index';

const { verifyMock } = vi.hoisted(() => ({
  verifyMock: vi.fn(),
}));

vi.mock('../config/env', () => ({
  env: {
    JWT_SECRET: '12345678901234567890123456789012',
    ADMIN_GITHUB_ID: '12345',
  },
}));

vi.mock('hono/jwt', () => ({
  verify: verifyMock,
}));

import { authAdmin } from './auth';

describe('authAdmin middleware', () => {
  it('returns 401 when admin token cookie is missing', async () => {
    const app = new Hono<AppEnv>();

    app.get('/admin/protected', authAdmin as never, (c) => c.json({ ok: true }));

    const response = await app.request('/admin/protected');
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

  it('returns 401 when token verification fails', async () => {
    verifyMock.mockRejectedValueOnce(new Error('invalid token'));

    const app = new Hono<AppEnv>();
    app.get('/admin/protected', authAdmin as never, (c) => c.json({ ok: true }));

    const response = await app.request('/admin/protected', {
      headers: {
        cookie: 'admin_token=invalid-token',
      },
    });

    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Invalid or expired session',
      },
    });
  });

  it('returns 403 when token subject is not the configured admin', async () => {
    verifyMock.mockResolvedValueOnce({
      sub: '99999',
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });

    const app = new Hono<AppEnv>();
    app.get('/admin/protected', authAdmin as never, (c) => c.json({ ok: true }));

    const response = await app.request('/admin/protected', {
      headers: {
        cookie: 'admin_token=some-token',
      },
    });

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'User not authorized',
      },
    });
  });

  it('allows request and sets admin context when token is valid', async () => {
    verifyMock.mockResolvedValueOnce({
      sub: '12345',
      role: 'admin',
      exp: Math.floor(Date.now() / 1000) + 3600,
      iat: Math.floor(Date.now() / 1000),
    });

    const app = new Hono<AppEnv>();
    app.get('/admin/protected', authAdmin as never, (c) => {
      return c.json({
        adminId: c.get('adminId'),
      });
    });

    const response = await app.request('/admin/protected', {
      headers: {
        cookie: 'admin_token=valid-token',
      },
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({
      adminId: '12345',
    });
  });
});
