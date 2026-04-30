/**
 * Canonical iframe domain allowlist shared between:
 *   - HTML sanitization (rehype-sanitize + rehypeEnforceIframeAllowlist in markdown.ts)
 *   - Content-Security-Policy frame-src directive in app.ts
 *
 * Both surfaces must derive their permitted domains from this single source so
 * that a change to the allowlist is automatically reflected in both the
 * sanitization pass and the browser execution policy.
 *
 * Format: origin prefix including trailing slash, e.g. "https://host/"
 * The trailing slash makes startsWith() checks unambiguous (prevents
 * "https://www.youtube.com.evil/" from matching "https://www.youtube.com/").
 */
export const ALLOWED_IFRAME_ORIGINS = [
  'https://www.youtube.com/',
  'https://www.youtube-nocookie.com/',
  'https://player.vimeo.com/',
] as const;

/**
 * Returns the list of allowed iframe origins as `frame-src` CSP token strings
 * (origin without trailing slash, as required by the CSP spec).
 */
export function iframeCspTokens(): string[] {
  return ALLOWED_IFRAME_ORIGINS.map((origin) => origin.replace(/\/$/, ''));
}
