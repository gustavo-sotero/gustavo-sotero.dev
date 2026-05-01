/**
 * Narrow helpers for inspecting postgres.js query errors without parsing raw
 * message text.
 */

export interface PostgresErrorLike {
  code?: string;
  constraint_name?: string;
  detail?: string;
}

const UNIQUE_VIOLATION_SQLSTATE = '23505';

/**
 * postgres.js surfaces native PostgreSQL SQLSTATE codes on query errors.
 * `23505` is the canonical unique-violation code.
 */
export function isUniqueViolationError(error: unknown): error is Error & PostgresErrorLike {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  return (error as PostgresErrorLike).code === UNIQUE_VIOLATION_SQLSTATE;
}
