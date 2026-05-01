import { z } from 'zod';

/** Protocols that are always rejected for media cover URLs. */
const REJECTED_PROTOCOLS = new Set(['file:', 'data:', 'ftp:', 'javascript:', 'vbscript:']);

/**
 * Returns true when the hostname is a private, loopback, or link-local address
 * that should never be reachable as public media.
 *
 * Covers:
 *  - "localhost" and any sub-label ending in ".localhost"
 *  - IPv4 loopback: 127.0.0.0/8
 *  - IPv4 private: 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16
 *  - IPv4 link-local: 169.254.0.0/16
 *  - IPv4 unspecified: 0.0.0.0/8
 *  - IPv6 loopback: ::1
 *  - IPv6 link-local: fe80::/10
 *  - IPv6 private (ULA): fc00::/7
 */
export function isPrivateOrLocalHostname(hostname: string): boolean {
  const h = hostname.toLowerCase().replace(/^\[|\]$/g, '');

  if (h === 'localhost' || h.endsWith('.localhost')) return true;

  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(h);
  if (ipv4) {
    const a = Number(ipv4[1]);
    const b = Number(ipv4[2]);
    if (a === 127) return true; // 127.0.0.0/8 loopback
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 169 && b === 254) return true; // 169.254.0.0/16 link-local
    if (a === 0) return true; // 0.0.0.0/8
  }

  if (h === '::1') return true; // IPv6 loopback
  // IPv6 link-local fe80::/10
  if (/^fe[89ab]/i.test(h)) return true;
  // IPv6 ULA fc00::/7
  if (/^f[cd]/i.test(h)) return true;

  return false;
}

/**
 * Shared cover-media URL schema for post and project cover images.
 *
 * Accepts:
 *  - Empty string (no cover)
 *  - HTTPS URLs to non-private, non-local hosts
 *
 * Rejects:
 *  - http:// (SSRF and mixed-content risk)
 *  - file:, data:, ftp:, javascript: and similar protocols
 *  - Localhost and private/RFC1918/link-local IP ranges
 *  - Malformed URLs
 */
export const coverUrlSchema = z.union([
  z.literal(''),
  z
    .string()
    .url('Cover URL must be a valid URL')
    .superRefine((val, ctx) => {
      let parsed: URL;
      try {
        parsed = new URL(val);
      } catch {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'Cover URL must be a valid URL' });
        return;
      }

      if (REJECTED_PROTOCOLS.has(parsed.protocol)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Cover URL protocol '${parsed.protocol}' is not allowed`,
        });
        return;
      }

      if (parsed.protocol !== 'https:') {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cover URL must use HTTPS',
        });
        return;
      }

      if (isPrivateOrLocalHostname(parsed.hostname)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Cover URL must not point to a private or local address',
        });
      }
    }),
]);
