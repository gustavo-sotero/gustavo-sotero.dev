/**
 * Trusted client IP extraction.
 *
 * With a single trusted reverse proxy (Traefik/Dokploy), the proxy appends
 * the observed TCP source IP as the **rightmost** entry in X-Forwarded-For.
 * The client controls all entries to the left — those can be spoofed.
 *
 * Strategy with 1 trusted proxy:
 *   X-Forwarded-For: <optional-spoofed>, <real-client-ip>
 *   ↑ client-controlled      ↑ Traefik-appended (cannot be spoofed)
 *
 * Taking the rightmost entry prevents IP spoofing for rate limiting and
 * analytics, regardless of what the client sends before the proxy.
 *
 * References:
 *   https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/X-Forwarded-For
 */

import type { Context } from 'hono';
import type { AppEnv } from '../types/index';

/**
 * Extract the real client IP from request headers.
 *
 * @param c               - Hono context
 * @param trustedProxies  - Number of trusted reverse-proxy hops in the chain (default: 1 for Traefik)
 */
export function getClientIp(c: Context<AppEnv>, trustedProxies = 1): string {
  const forwarded = c.req.header('x-forwarded-for');

  if (forwarded) {
    const parts = forwarded
      .split(',')
      .map((p) => p.trim())
      .filter(Boolean);

    // With N trusted proxies the real client IP is at index (length - N).
    // For trustedProxies=1: take the last entry Traefik appended.
    const targetIndex = parts.length - trustedProxies;
    const ip = targetIndex >= 0 ? parts[targetIndex] : parts[0];
    if (ip) return ip;
  }

  const realIp = c.req.header('x-real-ip');
  if (realIp) return realIp.trim();

  return 'unknown';
}
