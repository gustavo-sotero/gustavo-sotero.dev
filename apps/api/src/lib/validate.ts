/**
 * Shared validation helpers for Hono route handlers.
 *
 * Centralises:
 *  - Zod issue → API error details mapping (one canonical implementation)
 *  - Query-string validation (schema.safeParse + common error response)
 *  - Request body validation (combines parseBodyResult + schema.safeParse)
 *
 * These helpers delegate to the canonical response builders in `./response`
 * and the body parser in `./requestBody`, preserving their semantics.
 *
 * @example
 * ```ts
 * const qv = validateQuery(c, myQuerySchema, { page: c.req.query('page') });
 * if (!qv.ok) return qv.response;
 * // qv.data is typed as z.infer<typeof myQuerySchema>
 *
 * const bodyResult = await parseBodyResult(c);
 * const bv = validateBody(c, myBodySchema, bodyResult);
 * if (!bv.ok) return bv.response;
 * // bv.data is typed as z.infer<typeof myBodySchema>
 * ```
 */

import type { Context } from 'hono';
import type { ZodError, ZodSchema } from 'zod';
import type { AppEnv } from '../types/index';
import type { BodyParseResult } from './requestBody';
import { parseBodyResult } from './requestBody';
import { errorResponse } from './response';

// ── Zod issue mapping ─────────────────────────────────────────────────────────

/**
 * Maps Zod validation issues to the standardised API error details format.
 * An empty path (top-level / cross-field issues) is represented as `undefined`
 * so the `field` key is omitted from the serialised response rather than
 * appearing as an empty string.
 */
export function mapZodIssues(error: ZodError): Array<{ field?: string; message: string }> {
  return error.issues.map((issue) => ({
    ...(issue.path.length > 0 ? { field: issue.path.join('.') } : {}),
    message: issue.message,
  }));
}

// ── Discriminated result type ─────────────────────────────────────────────────

export type ValidationOk<T> = { ok: true; data: T };
export type ValidationFail = { ok: false; response: Response };
export type ValidationResult<T> = ValidationOk<T> | ValidationFail;

// ── Query-string validation ───────────────────────────────────────────────────

/**
 * Validates a plain object of query-string values against a Zod schema.
 *
 * On success  → `{ ok: true, data: T }`
 * On failure  → `{ ok: false, response: Response }` (400 VALIDATION_ERROR)
 */
export function validateQuery<T>(
  c: Context<AppEnv>,
  schema: ZodSchema<T>,
  raw: Record<string, unknown>
): ValidationResult<T> {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: errorResponse(
      c,
      400,
      'VALIDATION_ERROR',
      'Invalid query parameters',
      mapZodIssues(parsed.error)
    ),
  };
}

// ── Request body validation ───────────────────────────────────────────────────

/**
 * Validates a parsed body result against a Zod schema.
 *
 * Handles three outcomes in order:
 *  1. Body parse failure (missing body / malformed JSON / wrong content-type)
 *     → preserves the parse-specific error message and details from requestBody.ts
 *  2. Schema validation failure → 400 VALIDATION_ERROR with field-level details
 *  3. Success → `{ ok: true, data: T }`
 *
 * Parse failures and schema-validation failures remain distinguishable by their
 * `error.details[0].field` value ('body' / 'content-type' vs actual field paths).
 */
export function validateBody<T>(
  c: Context<AppEnv>,
  schema: ZodSchema<T>,
  bodyResult: BodyParseResult
): ValidationResult<T> {
  if (!bodyResult.ok) {
    return {
      ok: false,
      response: errorResponse(
        c,
        400,
        'VALIDATION_ERROR',
        bodyResult.error.message,
        bodyResult.error.details
      ),
    };
  }

  const parsed = schema.safeParse(bodyResult.data);
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: errorResponse(
      c,
      400,
      'VALIDATION_ERROR',
      'Validation failed',
      mapZodIssues(parsed.error)
    ),
  };
}

// ── Optional body validation ──────────────────────────────────────────────────

/**
 * Validates an optional body (e.g. DELETE with an optional `reason` field).
 *
 * Uses `parseBodyOrEmpty` semantics: if no body is provided, an empty object
 * `{}` is passed to the schema, which must accept optional input.
 *
 * On success  → `{ ok: true, data: T }`
 * On failure  → `{ ok: false, response: Response }` (400 VALIDATION_ERROR)
 */
export function validateOptionalBody<T>(
  c: Context<AppEnv>,
  schema: ZodSchema<T>,
  raw: unknown
): ValidationResult<T> {
  const parsed = schema.safeParse(raw ?? {});
  if (parsed.success) return { ok: true, data: parsed.data };
  return {
    ok: false,
    response: errorResponse(
      c,
      400,
      'VALIDATION_ERROR',
      'Validation failed',
      mapZodIssues(parsed.error)
    ),
  };
}

// ── Combined parse + validate ─────────────────────────────────────────────────

/**
 * Parses the request body and validates it against a Zod schema in one step.
 * Equivalent to calling `parseBodyResult(c)` then `validateBody(c, schema, result)`.
 *
 * @example
 * ```ts
 * const bv = await parseAndValidateBody(c, myBodySchema);
 * if (!bv.ok) return bv.response;
 * // bv.data is typed as z.infer<typeof myBodySchema>
 * ```
 */
export async function parseAndValidateBody<T>(
  c: Context<AppEnv>,
  schema: ZodSchema<T>
): Promise<ValidationResult<T>> {
  const bodyResult = await parseBodyResult(c);
  return validateBody(c, schema, bodyResult);
}
