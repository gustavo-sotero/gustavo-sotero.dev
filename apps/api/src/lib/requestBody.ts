/**
 * Centralized request body parsing helper.
 *
 * Replaces the scattered `c.req.json().catch(() => null)` pattern throughout
 * route handlers. Provides consistent behavior:
 *
 * - Missing body (no Content-Type / empty stream)  → returns `null`
 * - Malformed JSON                                  → returns `null`
 * - Valid JSON                                      → returns parsed value
 *
 * The returned value is always passed to a Zod schema's `.safeParse()` so
 * callers never need to handle `null` explicitly — the Zod validation error
 * will catch it and produce the standard `VALIDATION_ERROR` response.
 *
 * @example
 * ```ts
 * const body = await parseBody(c);
 * const parsed = createPostSchema.safeParse(body);
 * if (!parsed.success) { ... }
 * ```
 */

import type { Context } from 'hono';

export type BodyParseFailureReason = 'missing' | 'invalid_json' | 'unsupported_content_type';

export interface BodyParseFailure {
  reason: BodyParseFailureReason;
  message: string;
  details: Array<{ field: string; message: string }>;
}

export type BodyParseResult = { ok: true; data: unknown } | { ok: false; error: BodyParseFailure };

function normalizeContentType(contentType: string): string {
  return contentType.trim().toLowerCase();
}

function isJsonContentType(contentType: string): boolean {
  const normalized = normalizeContentType(contentType);
  return normalized.includes('application/json') || normalized.includes('+json');
}

function buildParseFailure(reason: BodyParseFailureReason): BodyParseFailure {
  if (reason === 'missing') {
    return {
      reason,
      message: 'Request body is required',
      details: [{ field: 'body', message: 'Request body is required' }],
    };
  }

  if (reason === 'invalid_json') {
    return {
      reason,
      message: 'Malformed JSON request body',
      details: [{ field: 'body', message: 'Malformed JSON request body' }],
    };
  }

  return {
    reason,
    message: 'Content-Type must be application/json',
    details: [{ field: 'content-type', message: 'Content-Type must be application/json' }],
  };
}

/**
 * Parses a JSON body while distinguishing missing body, malformed JSON, and
 * unsupported content-type.
 */
export async function parseBodyResult(c: Context): Promise<BodyParseResult> {
  const contentType = c.req.header('content-type') ?? '';
  if (contentType && !isJsonContentType(contentType)) {
    return { ok: false, error: buildParseFailure('unsupported_content_type') };
  }

  let rawBody = '';
  try {
    rawBody = await c.req.raw.clone().text();
  } catch {
    return { ok: false, error: buildParseFailure('invalid_json') };
  }

  if (rawBody.trim().length === 0) {
    return { ok: false, error: buildParseFailure('missing') };
  }

  try {
    return { ok: true, data: JSON.parse(rawBody) };
  } catch {
    return { ok: false, error: buildParseFailure('invalid_json') };
  }
}

/**
 * Safely parse the JSON request body.
 *
 * Returns `null` for missing, empty, or malformed bodies rather than throwing.
 * Downstream Zod `.safeParse(null)` produces a consistent validation error.
 */
export async function parseBody(c: Context): Promise<unknown> {
  const parsed = await parseBodyResult(c);
  return parsed.ok ? parsed.data : null;
}

/**
 * Variant that returns an empty object `{}` instead of `null` on failure.
 * Use for routes where the body is fully optional (e.g. DELETE with optional reason).
 */
export async function parseBodyOrEmpty(c: Context): Promise<unknown> {
  const parsed = await parseBodyResult(c);
  if (!parsed.ok) {
    return {};
  }
  return parsed.data;
}
