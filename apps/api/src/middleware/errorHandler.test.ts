import type { Handler } from 'hono';
import { Hono } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { describe, expect, it, vi } from 'vitest';
import { z } from 'zod';
import type { AppEnv } from '../types/index';

/** Shape of every API error response used in this file. */
interface ApiErrorBody {
  success: false;
  error: {
    code: string;
    type: string;
    message: string;
    details?: Array<{ field: string; message: string }>;
  };
}

// ── Logger mock ───────────────────────────────────────────────────────────────
// Must use vi.hoisted() because vi.mock() calls are hoisted before const declarations.

const { loggerMock } = vi.hoisted(() => ({
  loggerMock: {
    warn: vi.fn(),
    info: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../config/logger', () => ({
  getLogger: () => loggerMock,
}));

import { AiConfigError } from '../lib/errors';
import { globalErrorHandler, normalizeCause } from './errorHandler';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Build a minimal Hono app wired to globalErrorHandler with a requestId
 * variable pre-set so the handler can always read it.
 */
function buildApp(throwFn: Handler<AppEnv>) {
  const app = new Hono<AppEnv>();

  app.use('*', async (c, next) => {
    c.set('requestId', 'test-req-id');
    await next();
  });

  app.get('/test', throwFn);

  app.onError(globalErrorHandler);

  return app;
}

// ── normalizeCause ────────────────────────────────────────────────────────────

describe('normalizeCause()', () => {
  it('returns null for null/undefined', () => {
    expect(normalizeCause(null)).toBeNull();
    expect(normalizeCause(undefined)).toBeNull();
  });

  it('extracts name/message/stack from an Error instance', () => {
    const err = new Error('boom');
    const result = normalizeCause(err) as Record<string, unknown>;
    expect(result.name).toBe('Error');
    expect(result.message).toBe('boom');
    expect(typeof result.stack).toBe('string');
  });

  it('returns the string as-is', () => {
    expect(normalizeCause('some cause')).toBe('some cause');
  });

  it('shallow-copies plain objects and redacts sensitive keys', () => {
    const cause = { foo: 'bar', token: 'supersecret', password: '1234' };
    const result = normalizeCause(cause) as Record<string, unknown>;
    expect(result.foo).toBe('bar');
    expect(result.token).toBe('[REDACTED]');
    expect(result.password).toBe('[REDACTED]');
  });

  it('falls back to String() for primitives like numbers', () => {
    expect(normalizeCause(42)).toBe('42');
    expect(normalizeCause(true)).toBe('true');
  });
});

// ── globalErrorHandler — ZodError ─────────────────────────────────────────────

describe('globalErrorHandler — ZodError', () => {
  it('returns 400 VALIDATION_ERROR with issue details', async () => {
    const schema = z.object({ name: z.string() });

    const app = buildApp((_c) => {
      schema.parse({ name: 42 }); // triggers ZodError
      throw new Error('unreachable');
    });

    const res = await app.request('/test');
    const body = (await res.json()) as ApiErrorBody;

    expect(res.status).toBe(400);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.type).toBe('validation');
    expect(Array.isArray(body.error.details)).toBe(true);
  });

  it('logs a warn with requestId, path and method', async () => {
    loggerMock.warn.mockClear();

    const schema = z.object({ age: z.number() });
    const app = buildApp((_c) => {
      schema.parse({ age: 'not-a-number' });
      throw new Error('unreachable');
    });

    await app.request('/test');

    expect(loggerMock.warn).toHaveBeenCalledOnce();
    const [, props] = loggerMock.warn.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(props.requestId).toBe('test-req-id');
    expect(props.path).toBe('/test');
    expect(props.method).toBe('GET');
  });
});

// ── globalErrorHandler — HTTPException ───────────────────────────────────────

describe('globalErrorHandler — HTTPException', () => {
  const cases: Array<[number, string, string]> = [
    [400, 'VALIDATION_ERROR', 'validation'],
    [401, 'UNAUTHORIZED', 'unauthorized'],
    [403, 'FORBIDDEN', 'forbidden'],
    [404, 'NOT_FOUND', 'not_found'],
    [409, 'CONFLICT', 'conflict'],
    [429, 'RATE_LIMITED', 'rate_limited'],
    [503, 'SERVICE_UNAVAILABLE', 'internal'],
  ];

  it.each(cases)('maps HTTP %i to code %s', async (status, code, type) => {
    const app = buildApp((_c) => {
      throw new HTTPException(status as never, { message: `error ${status}` });
    });

    const res = await app.request('/test');
    const body = (await res.json()) as ApiErrorBody;

    expect(res.status).toBe(status);
    expect(body.error.code).toBe(code);
    expect(body.error.type).toBe(type);
  });

  it('logs an info entry with requestId, path, method and status', async () => {
    loggerMock.info.mockClear();

    const app = buildApp((_c) => {
      throw new HTTPException(404, { message: 'not found' });
    });

    await app.request('/test');

    expect(loggerMock.info).toHaveBeenCalledOnce();
    const [, props] = loggerMock.info.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(props.requestId).toBe('test-req-id');
    expect(props.path).toBe('/test');
    expect(props.method).toBe('GET');
    expect(props.status).toBe(404);
  });

  it('falls back to INTERNAL_ERROR for unmapped HTTP status codes', async () => {
    const app = buildApp((_c) => {
      throw new HTTPException(418 as never, { message: "I'm a teapot" });
    });

    const res = await app.request('/test');
    const body = (await res.json()) as ApiErrorBody;

    expect(res.status).toBe(418);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.type).toBe('internal');
  });
});

// ── globalErrorHandler — domain typed errors ─────────────────────────────────

describe('globalErrorHandler — domain typed errors', () => {
  it('maps AiConfigError availability failures to 503 CONFIGURATION_ERROR', async () => {
    loggerMock.error.mockClear();

    const app = buildApp((_c) => {
      throw new AiConfigError('NOT_CONFIGURED', 'not configured');
    });

    const res = await app.request('/test');
    const body = (await res.json()) as ApiErrorBody;

    expect(res.status).toBe(503);
    expect(body.error.code).toBe('CONFIGURATION_ERROR');
    expect(body.error.type).toBe('configuration');
    expect(body.error.message).toBe('AI post generation is not configured');
    expect(loggerMock.error).not.toHaveBeenCalled();
  });

  it('maps AiConfigError INVALID_MODELS to 400 VALIDATION_ERROR with issues', async () => {
    loggerMock.error.mockClear();

    const app = buildApp((_c) => {
      throw new AiConfigError('INVALID_MODELS', 'Invalid models', {
        issues: ['Topics model is unavailable', 'Draft model is unavailable'],
      });
    });

    const res = await app.request('/test');
    const body = (await res.json()) as ApiErrorBody;

    expect(res.status).toBe(400);
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.type).toBe('validation');
    expect(body.error.message).toBe('Invalid models');
    expect(body.error.details).toEqual([
      { message: 'Topics model is unavailable' },
      { message: 'Draft model is unavailable' },
    ]);
    expect(loggerMock.error).not.toHaveBeenCalled();
  });
});

// ── globalErrorHandler — Unexpected errors ────────────────────────────────────

describe('globalErrorHandler — unexpected errors', () => {
  it('returns 500 INTERNAL_ERROR without exposing internals to client', async () => {
    const app = buildApp((_c) => {
      throw new Error('database connection refused');
    });

    const res = await app.request('/test');
    const body = (await res.json()) as ApiErrorBody;

    expect(res.status).toBe(500);
    expect(body.success).toBe(false);
    expect(body.error.code).toBe('INTERNAL_ERROR');
    // Generic client message — no internal details
    expect(body.error.message).toBe('An unexpected error occurred');
  });

  it('logs error with requestId, path, method, name, message and stack', async () => {
    loggerMock.error.mockClear();

    const app = buildApp((_c) => {
      throw new Error('something blew up');
    });

    await app.request('/test');

    expect(loggerMock.error).toHaveBeenCalledOnce();
    const [, props] = loggerMock.error.mock.calls[0] as [unknown, Record<string, unknown>];
    expect(props.requestId).toBe('test-req-id');
    expect(props.path).toBe('/test');
    expect(props.method).toBe('GET');
    expect(props.errorName).toBe('Error');
    expect(props.errorMessage).toBe('something blew up');
    expect(typeof props.stack).toBe('string');
  });

  it('logs normalized cause when present', async () => {
    loggerMock.error.mockClear();

    const cause = new Error('root cause');
    const app = buildApp((_c) => {
      const wrapped = new Error('wrapper');
      (wrapped as Error & { cause: unknown }).cause = cause;
      throw wrapped;
    });

    await app.request('/test');

    expect(loggerMock.error).toHaveBeenCalledOnce();
    const [, props] = loggerMock.error.mock.calls[0] as [unknown, Record<string, unknown>];
    const loggedCause = props.cause as Record<string, unknown>;
    expect(loggedCause.message).toBe('root cause');
    expect(loggedCause.name).toBe('Error');
  });

  it('does not include cause key when cause is absent', async () => {
    loggerMock.error.mockClear();

    const app = buildApp((_c) => {
      throw new Error('bare error');
    });

    await app.request('/test');

    const [, props] = loggerMock.error.mock.calls[0] as [unknown, Record<string, unknown>];
    expect('cause' in props).toBe(false);
  });

  it('does not leak sensitive data in the cause', async () => {
    loggerMock.error.mockClear();

    const app = buildApp((_c) => {
      const err = new Error('oauth failure');
      (err as Error & { cause: unknown }).cause = { token: 'SECRET', userId: 'u-1' };
      throw err;
    });

    await app.request('/test');

    const [, props] = loggerMock.error.mock.calls[0] as [unknown, Record<string, unknown>];
    const loggedCause = props.cause as Record<string, unknown>;
    expect(loggedCause.token).toBe('[REDACTED]');
    expect(loggedCause.userId).toBe('u-1');
  });
});
