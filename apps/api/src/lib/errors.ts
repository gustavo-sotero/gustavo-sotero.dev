/**
 * Typed domain error classes for the API service layer.
 *
 * These replace the legacy text-prefix conventions (`CONFLICT: ...`,
 * `VALIDATION_ERROR: ...`) that forced routes and the global error handler
 * to parse error messages as a protocol.
 *
 * Usage in service code:
 *
 *   throw new ConflictError('Slug "foo" is already taken');
 *   throw new DomainValidationError('Invalid tag IDs', [{ field: 'tagIds', message: '...' }]);
 *
 * Usage in route handlers:
 *
 *   } catch (err) {
 *     if (err instanceof ConflictError) return errorResponse(c, 409, 'CONFLICT', err.message);
 *     if (err instanceof DomainValidationError) return errorResponse(c, 400, 'VALIDATION_ERROR', err.message, err.details);
 *     throw err;
 *   }
 */

export interface ValidationErrorDetail {
  field?: string;
  message: string;
}

export type AiConfigErrorCode =
  | 'DISABLED'
  | 'NOT_CONFIGURED'
  | 'INVALID_CONFIG'
  | 'NO_API_KEY'
  | 'CATALOG_UNAVAILABLE'
  | 'INVALID_MODELS';

export interface AiConfigErrorOptions {
  cause?: unknown;
  issues?: string[];
}

/**
 * Thrown when a create/update operation would violate a uniqueness constraint
 * (slug or name already taken, duplicate state transition, etc.).
 */
export class ConflictError extends Error {
  readonly kind = 'conflict' as const;

  constructor(message: string) {
    super(message);
    this.name = 'ConflictError';
  }
}

/**
 * Thrown when domain-level validation fails before any DB write:
 * invalid foreign-key IDs, date range inconsistency, etc.
 *
 * `details` maps to the standard `ApiErrorDetail[]` shape consumed by the UI.
 */
export class DomainValidationError extends Error {
  readonly kind = 'validation' as const;
  readonly details?: ValidationErrorDetail[];

  constructor(message: string, details?: ValidationErrorDetail[]) {
    super(message);
    this.name = 'DomainValidationError';
    this.details = details;
  }
}

/**
 * Thrown when the highlight-per-category cap is exceeded for a skill.
 * Semantically a conflict (existing state blocks the requested state transition).
 */
export class HighlightLimitError extends Error {
  readonly kind = 'conflict' as const;

  constructor(message: string) {
    super(message);
    this.name = 'HighlightLimitError';
  }
}

/**
 * Thrown when an entity is not found.
 * Lets service code propagate not-found conditions through the call stack
 * when the route handler cannot distinguish from context alone.
 */
export class NotFoundError extends Error {
  readonly kind = 'not_found' as const;

  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}

/**
 * Thrown when a service-level rate limit or anti-spam cooldown is active.
 * Distinct from HTTP-layer rate limiting (which uses middleware) — this is
 * domain logic (e.g., per-email comment cooldown) that belongs in the service.
 */
export class RateLimitedError extends Error {
  readonly kind = 'rate_limited' as const;

  constructor(message: string) {
    super(message);
    this.name = 'RateLimitedError';
  }
}

/**
 * Typed configuration error for the AI post-generation feature.
 *
 * This keeps configuration failures explicit across services and route handlers
 * without falling back to generic Error instances with ad-hoc properties.
 */
export class AiConfigError extends Error {
  readonly kind = 'configuration' as const;
  readonly code: AiConfigErrorCode;
  readonly issues?: string[];
  override readonly cause?: unknown;

  constructor(code: AiConfigErrorCode, message: string, options?: AiConfigErrorOptions) {
    super(message);
    this.name = 'AiConfigError';
    this.code = code;
    this.issues = options?.issues;
    this.cause = options?.cause;
  }
}
