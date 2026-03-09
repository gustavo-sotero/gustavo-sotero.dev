import type { Context } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { ZodError } from 'zod';
import { getLogger } from '../config/logger';
import { errorResponse } from '../lib/response';
import type { AppEnv } from '../types/index';

const logger = getLogger('errors');

// ── Sensitive-Data Guardrails ─────────────────────────────────────────────────

/**
 * Fields that must never appear verbatim in log output.
 * Checked against property keys of objects, not against values.
 */
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'secret',
  'authorization',
  'cookie',
  'set-cookie',
  'x-csrf-token',
  'admin_token',
  'csrf_token',
  'jwt',
  'access_token',
  'refresh_token',
]);

/**
 * Normalize an error `cause` to a safely-loggable value.
 *
 * Rules:
 * - `Error` instance → `{ name, message, stack }`
 * - `string` → returned as-is
 * - plain `object` → shallow copy with sensitive keys removed
 * - everything else → `String(value)` fallback
 */
export function normalizeCause(cause: unknown): Record<string, unknown> | string | null {
  if (cause == null) return null;

  if (cause instanceof Error) {
    return {
      name: cause.name,
      message: cause.message,
      stack: cause.stack,
    };
  }

  if (typeof cause === 'string') return cause;

  if (typeof cause === 'object') {
    const safe: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(cause as Record<string, unknown>)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        safe[k] = '[REDACTED]';
      } else {
        safe[k] = v;
      }
    }
    return safe;
  }

  // number, boolean, symbol, etc.
  try {
    return String(cause);
  } catch {
    return '[unserializable cause]';
  }
}

// ── Global Error Handler ──────────────────────────────────────────────────────

/**
 * Global Hono error handler.
 * Maps known error types to standardized responses.
 * Never leaks stack traces to the client.
 *
 * Every 5xx logs a canonical payload with:
 *   requestId · path · method · error name · message · stack · cause
 */
export function globalErrorHandler(err: Error, c: Context<AppEnv>): Response {
  const requestId = c.get('requestId') ?? 'unknown';
  const path = c.req.path;
  const method = c.req.method;

  // ── Zod validation errors ───────────────────────────────────────────────────
  if (err instanceof ZodError) {
    logger.warn(`[${method} ${path}] Validation error {requestId}`, {
      requestId,
      path,
      method,
      issues: err.issues,
    });

    const details = err.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }));

    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Validation failed', details);
  }

  // ── Hono HTTP exceptions ────────────────────────────────────────────────────
  if (err instanceof HTTPException) {
    logger.info(`[${method} ${path}] HTTP ${err.status} {requestId}`, {
      requestId,
      path,
      method,
      status: err.status,
      message: err.message,
    });

    const status = err.status;
    if (status === 400) return errorResponse(c, 400, 'VALIDATION_ERROR', err.message);
    if (status === 401) return errorResponse(c, 401, 'UNAUTHORIZED', err.message);
    if (status === 403) return errorResponse(c, 403, 'FORBIDDEN', err.message);
    if (status === 404) return errorResponse(c, 404, 'NOT_FOUND', err.message);
    if (status === 409) return errorResponse(c, 409, 'CONFLICT', err.message);
    if (status === 429) return errorResponse(c, 429, 'RATE_LIMITED', err.message);
    if (status === 503) return errorResponse(c, 503, 'SERVICE_UNAVAILABLE', err.message);

    return errorResponse(c, status, 'INTERNAL_ERROR', err.message);
  }

  // ── Unexpected errors ───────────────────────────────────────────────────────
  // Log full context but never expose internals to the client.
  const cause = normalizeCause((err as Error & { cause?: unknown }).cause);

  logger.error(`[${method} ${path}] ${err.name}: ${err.message} {requestId}`, {
    requestId,
    path,
    method,
    errorName: err.name,
    errorMessage: err.message,
    stack: err.stack,
    ...(cause != null ? { cause } : {}),
  });

  return errorResponse(c, 500, 'INTERNAL_ERROR', 'An unexpected error occurred');
}
