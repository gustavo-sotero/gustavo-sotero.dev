import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { csrfProtection } from './csrf';

describe('csrfProtection middleware', () => {
  it('rejects when csrf header is missing', async () => {
    const app = new Hono();

    app.post('/secure', csrfProtection as never, (c) => c.json({ ok: true }));

    const response = await app.request('/secure', {
      method: 'POST',
      headers: {
        cookie: 'csrf_token=token-123',
      },
    });

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid CSRF token',
      },
    });
  });

  it('allows request when cookie and header tokens match', async () => {
    const app = new Hono();

    app.post('/secure', csrfProtection as never, (c) => c.json({ ok: true }));

    const response = await app.request('/secure', {
      method: 'POST',
      headers: {
        cookie: 'csrf_token=token-123',
        'x-csrf-token': 'token-123',
      },
    });

    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ ok: true });
  });

  it('rejects when csrf header and cookie lengths differ', async () => {
    const app = new Hono();

    app.post('/secure', csrfProtection as never, (c) => c.json({ ok: true }));

    const response = await app.request('/secure', {
      method: 'POST',
      headers: {
        cookie: 'csrf_token=token-12345',
        'x-csrf-token': 'token-1',
      },
    });

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid CSRF token',
      },
    });
  });

  it('rejects when csrf header and cookie differ with equal length', async () => {
    const app = new Hono();

    app.post('/secure', csrfProtection as never, (c) => c.json({ ok: true }));

    const response = await app.request('/secure', {
      method: 'POST',
      headers: {
        cookie: 'csrf_token=token-123',
        'x-csrf-token': 'token-456',
      },
    });

    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body).toEqual({
      success: false,
      error: {
        code: 'FORBIDDEN',
        message: 'Invalid CSRF token',
      },
    });
  });
});
