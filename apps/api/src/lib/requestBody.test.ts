import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { parseBody, parseBodyOrEmpty, parseBodyResult } from './requestBody';

function createParseBodyTestApp() {
  const app = new Hono();

  app.post('/result', async (c) => {
    const result = await parseBodyResult(c);
    return c.json(result);
  });

  app.post('/legacy', async (c) => {
    const body = await parseBody(c);
    return c.json({ body });
  });

  app.post('/or-empty', async (c) => {
    const body = await parseBodyOrEmpty(c);
    return c.json({ body });
  });

  return app;
}

describe('requestBody parser', () => {
  it('returns ok=true with parsed JSON payload', async () => {
    const app = createParseBodyTestApp();

    const response = await app.request('/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'hello' }),
    });

    const payload = await response.json();
    expect(payload).toEqual({
      ok: true,
      data: { title: 'hello' },
    });
  });

  it('returns missing-body failure for empty JSON payload', async () => {
    const app = createParseBodyTestApp();

    const response = await app.request('/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });

    const payload = await response.json();
    expect(payload).toEqual({
      ok: false,
      error: {
        reason: 'missing',
        message: 'Request body is required',
        details: [{ field: 'body', message: 'Request body is required' }],
      },
    });
  });

  it('returns invalid_json failure for malformed JSON', async () => {
    const app = createParseBodyTestApp();

    const response = await app.request('/result', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"title":',
    });

    const payload = await response.json();
    expect(payload).toEqual({
      ok: false,
      error: {
        reason: 'invalid_json',
        message: 'Malformed JSON request body',
        details: [{ field: 'body', message: 'Malformed JSON request body' }],
      },
    });
  });

  it('returns unsupported_content_type failure for non-JSON payload', async () => {
    const app = createParseBodyTestApp();

    const response = await app.request('/result', {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain' },
      body: 'hello',
    });

    const payload = await response.json();
    expect(payload).toEqual({
      ok: false,
      error: {
        reason: 'unsupported_content_type',
        message: 'Content-Type must be application/json',
        details: [{ field: 'content-type', message: 'Content-Type must be application/json' }],
      },
    });
  });

  it('keeps parseBody backward-compatible by returning null on parse failure', async () => {
    const app = createParseBodyTestApp();

    const response = await app.request('/legacy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '{"invalid":',
    });

    const payload = await response.json();
    expect(payload).toEqual({ body: null });
  });

  it('returns empty object for parseBodyOrEmpty when body is missing', async () => {
    const app = createParseBodyTestApp();

    const response = await app.request('/or-empty', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: '',
    });

    const payload = await response.json();
    expect(payload).toEqual({ body: {} });
  });
});
