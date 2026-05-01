/**
 * Canonical HTTP method groups shared across runtimes.
 *
 * The mutating subset drives:
 * - browser-side CSRF header injection
 * - API-side admin CSRF enforcement
 * - API-side CORS allowMethods for admin preflight requests
 *
 * Keeping these methods in one place prevents the original drift where
 * PUT existed as a real admin mutation but was missing from one side of
 * the protection envelope.
 */

export const MUTATING_HTTP_METHODS = ['POST', 'PUT', 'PATCH', 'DELETE'] as const;

export type MutatingHttpMethod = (typeof MUTATING_HTTP_METHODS)[number];

export const CORS_ALLOW_METHODS = ['GET', ...MUTATING_HTTP_METHODS, 'OPTIONS'] as const;

export type CorsAllowMethod = (typeof CORS_ALLOW_METHODS)[number];

export function isMutatingHttpMethod(method: string): method is MutatingHttpMethod {
  return (MUTATING_HTTP_METHODS as readonly string[]).includes(method.toUpperCase());
}
