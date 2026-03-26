import { Hono } from 'hono';
import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import type { AppEnv } from '../types/index';
import type { BodyParseResult } from './requestBody';
import {
  mapZodIssues,
  parseAndValidateBody,
  validateBody,
  validateOptionalBody,
  validateQuery,
} from './validate';

// ── mapZodIssues ──────────────────────────────────────────────────────────────

describe('mapZodIssues', () => {
  it('maps a simple field issue to field + message', () => {
    const parsed = z.object({ title: z.string().min(1) }).safeParse({ title: '' });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const details = mapZodIssues(parsed.error);
    expect(details).toEqual([{ field: 'title', message: expect.any(String) }]);
  });

  it('joins nested path segments with dot notation', () => {
    const parsed = z
      .object({ author: z.object({ name: z.string().min(1) }) })
      .safeParse({ author: { name: '' } });
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const details = mapZodIssues(parsed.error);
    expect(details[0]).toMatchObject({ field: 'author.name' });
  });

  it('omits field key for top-level cross-field issues (empty path)', () => {
    const schema = z
      .object({ a: z.string().optional(), b: z.string().optional() })
      .superRefine((_, ctx) => {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: [], message: 'At least one required' });
      });

    const parsed = schema.safeParse({});
    expect(parsed.success).toBe(false);
    if (parsed.success) return;

    const details = mapZodIssues(parsed.error);
    const crossField = details.find((d) => d.message === 'At least one required');
    expect(crossField).toBeDefined();
    expect(crossField).not.toHaveProperty('field');
  });
});

// ── shared response body types for assertions ────────────────────────────────

type ErrBody = {
  success: false;
  error: { code: string; message: string; details?: Array<{ field?: string; message: string }> };
};
type OkBody<T = Record<string, unknown>> = { ok: true; data: T };

// ── validateQuery ─────────────────────────────────────────────────────────────

function makeQueryApp(schema: z.ZodSchema) {
  const app = new Hono<AppEnv>();
  app.get('/query', (c) => {
    const qv = validateQuery(c, schema, {
      page: c.req.query('page'),
      size: c.req.query('size'),
    });
    if (!qv.ok) return qv.response;
    return c.json({ ok: true, data: qv.data });
  });
  return app;
}

const querySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).optional(),
});

describe('validateQuery', () => {
  it('returns ok=true with coerced data on valid input', async () => {
    const app = makeQueryApp(querySchema);
    const response = await app.request('/query?page=2&size=50');
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data: { page: 2, size: 50 } });
  });

  it('returns 400 VALIDATION_ERROR with field details on invalid input', async () => {
    const app = makeQueryApp(querySchema);
    const response = await app.request('/query?page=-1');
    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Invalid query parameters');
    expect(Array.isArray(body.error.details)).toBe(true);
    expect(body.error.details?.[0]).toMatchObject({ field: 'page', message: expect.any(String) });
  });
});

// ── validateBody ──────────────────────────────────────────────────────────────

const bodySchema = z.object({
  title: z.string().min(1),
  count: z.number().int().optional(),
});

function makeBodyResult(data: unknown): BodyParseResult {
  return { ok: true, data };
}

function makeBodyFailure(
  reason: 'missing' | 'invalid_json' | 'unsupported_content_type',
  message: string,
  details: Array<{ field: string; message: string }>
): BodyParseResult {
  return { ok: false, error: { reason, message, details } };
}

function makeBodyApp(bodyResult: BodyParseResult, schema: z.ZodSchema) {
  const app = new Hono<AppEnv>();
  app.post('/body', (c) => {
    const bv = validateBody(c, schema, bodyResult);
    if (!bv.ok) return bv.response;
    return c.json({ ok: true, data: bv.data });
  });
  return app;
}

describe('validateBody', () => {
  it('returns ok=true with validated data on valid body', async () => {
    const app = makeBodyApp(makeBodyResult({ title: 'Hello', count: 3 }), bodySchema);
    const response = await app.request('/body', { method: 'POST' });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data: { title: 'Hello', count: 3 } });
  });

  it('returns 400 with validation details on schema failure', async () => {
    const app = makeBodyApp(makeBodyResult({ title: '' }), bodySchema);
    const response = await app.request('/body', { method: 'POST' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Validation failed');
    expect(body.error.details?.[0]).toMatchObject({ field: 'title' });
  });

  it('preserves parse-failure message and field for missing body', async () => {
    const failure = makeBodyFailure('missing', 'Request body is required', [
      { field: 'body', message: 'Request body is required' },
    ]);
    const app = makeBodyApp(failure, bodySchema);
    const response = await app.request('/body', { method: 'POST' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrBody;
    expect(body.error.message).toBe('Request body is required');
    expect(body.error.details?.[0]?.field).toBe('body');
  });

  it('preserves parse-failure message for invalid JSON', async () => {
    const failure = makeBodyFailure('invalid_json', 'Malformed JSON request body', [
      { field: 'body', message: 'Malformed JSON request body' },
    ]);
    const app = makeBodyApp(failure, bodySchema);
    const response = await app.request('/body', { method: 'POST' });
    const body = (await response.json()) as ErrBody;
    expect(body.error.message).toBe('Malformed JSON request body');
    // parse failure has field='body', distinguishable from schema field errors
    expect(body.error.details?.[0]?.field).toBe('body');
  });

  it('parse failures and schema-validation failures produce the same error code', async () => {
    const parseFailApp = makeBodyApp(
      makeBodyFailure('missing', 'Request body is required', [
        { field: 'body', message: 'Request body is required' },
      ]),
      bodySchema
    );
    const schemaFailApp = makeBodyApp(makeBodyResult({ title: '' }), bodySchema);

    const [parseRes, schemaRes] = await Promise.all([
      parseFailApp.request('/body', { method: 'POST' }),
      schemaFailApp.request('/body', { method: 'POST' }),
    ]);

    const [parseBody, schemaBody] = await Promise.all([
      parseRes.json() as Promise<ErrBody>,
      schemaRes.json() as Promise<ErrBody>,
    ]);

    expect(parseBody.error.code).toBe('VALIDATION_ERROR');
    expect(schemaBody.error.code).toBe('VALIDATION_ERROR');
    // But messages differ, keeping them distinguishable
    expect(parseBody.error.message).not.toBe(schemaBody.error.message);
  });
});

// ── validateOptionalBody ──────────────────────────────────────────────────────

const optionalBodySchema = z.object({
  reason: z.string().min(1).optional(),
});

function makeOptionalBodyApp(raw: unknown, schema: z.ZodSchema) {
  const app = new Hono<AppEnv>();
  app.delete('/resource', (c) => {
    const bv = validateOptionalBody(c, schema, raw);
    if (!bv.ok) return bv.response;
    return c.json({ ok: true, data: bv.data });
  });
  return app;
}

describe('validateOptionalBody', () => {
  it('returns ok=true with empty data when body is absent (undefined)', async () => {
    const app = makeOptionalBodyApp(undefined, optionalBodySchema);
    const response = await app.request('/resource', { method: 'DELETE' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as OkBody<Record<string, unknown>>;
    expect(body.ok).toBe(true);
    expect(body.data).toEqual({});
  });

  it('returns ok=true when valid optional field is provided', async () => {
    const app = makeOptionalBodyApp({ reason: 'spam' }, optionalBodySchema);
    const response = await app.request('/resource', { method: 'DELETE' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as OkBody<{ reason?: string }>;
    expect(body.data).toEqual({ reason: 'spam' });
  });

  it('returns 400 VALIDATION_ERROR when field value is invalid', async () => {
    // reason is min(1), so empty string fails
    const app = makeOptionalBodyApp({ reason: '' }, optionalBodySchema);
    const response = await app.request('/resource', { method: 'DELETE' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as {
      success: boolean;
      error: { code: string; message: string; details: Array<{ field?: string; message: string }> };
    };
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Validation failed');
    expect(body.error.details[0]).toMatchObject({ field: 'reason' });
  });

  it('passes null as empty object — same semantics as absent body', async () => {
    const app = makeOptionalBodyApp(null, optionalBodySchema);
    const response = await app.request('/resource', { method: 'DELETE' });
    expect(response.status).toBe(200);
    const body = (await response.json()) as OkBody;
    expect(body.ok).toBe(true);
  });
});

// ── parseAndValidateBody ──────────────────────────────────────────────────────

const parseAndValidateSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().positive(),
});

function makeParseAndValidateApp(schema: z.ZodSchema) {
  const app = new Hono<AppEnv>();
  app.post('/resource', async (c) => {
    const bv = await parseAndValidateBody(c, schema);
    if (!bv.ok) return bv.response;
    return c.json({ ok: true, data: bv.data });
  });
  return app;
}

describe('parseAndValidateBody', () => {
  it('returns ok=true with validated data when body and schema are valid', async () => {
    const app = makeParseAndValidateApp(parseAndValidateSchema);
    const response = await app.request('/resource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Alice', age: 30 }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual({ ok: true, data: { name: 'Alice', age: 30 } });
  });

  it('returns 400 VALIDATION_ERROR when schema validation fails', async () => {
    const app = makeParseAndValidateApp(parseAndValidateSchema);
    const response = await app.request('/resource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: '', age: 30 }),
    });
    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.details?.[0]).toMatchObject({ field: 'name' });
  });

  it('returns 400 VALIDATION_ERROR when no body is provided', async () => {
    const app = makeParseAndValidateApp(parseAndValidateSchema);
    // POST with no body and no Content-Type — triggers parse failure
    const response = await app.request('/resource', { method: 'POST' });
    expect(response.status).toBe(400);
    const body = (await response.json()) as ErrBody;
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });
});
