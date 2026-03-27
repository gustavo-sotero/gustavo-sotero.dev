/**
 * Unit tests for apps/web/src/app/robots.ts
 *
 * Verifies that the robots rules are correct for the path-based API topology:
 *  - /admin/ is blocked (not public)
 *  - /api/ is NOT blocked — sitemap.xml, feed.xml and /doc must be reachable
 *  - sitemap points to NEXT_PUBLIC_API_URL/sitemap.xml (path-based in production)
 *  - host is SITE_METADATA.url (the site origin, never the API URL)
 */
import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/env', () => ({
  env: { NEXT_PUBLIC_API_URL: 'https://example.com/api' },
}));

vi.mock('@/lib/constants', () => ({
  SITE_METADATA: { url: 'https://example.test' },
}));

import robots from './robots';

describe('robots()', () => {
  it('disallows /admin/', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const allDisallows = rules.flatMap((r) => {
      const d = r.disallow;
      return Array.isArray(d) ? d : d ? [d] : [];
    });
    expect(allDisallows).toContain('/admin/');
  });

  it('does NOT disallow /api/ — sitemap.xml and feed.xml must remain crawlable', () => {
    const result = robots();
    const rules = Array.isArray(result.rules) ? result.rules : [result.rules];
    const allDisallows = rules.flatMap((r) => {
      const d = r.disallow;
      return Array.isArray(d) ? d : d ? [d] : [];
    });
    // No rule may start with /api — that namespace belongs to public API documents
    for (const rule of allDisallows.filter(Boolean)) {
      expect(String(rule)).not.toMatch(/^\/api/);
    }
  });

  it('uses NEXT_PUBLIC_API_URL for the sitemap self-link', () => {
    const result = robots();
    // In path-based topology the sitemap lives under the API /api prefix
    expect(result.sitemap).toBe('https://example.com/api/sitemap.xml');
  });

  it('uses SITE_METADATA.url as the canonical host (not the API URL)', () => {
    const result = robots();
    expect(result.host).toBe('https://example.test');
    expect(result.host).not.toContain('/api');
  });
});
