import type { MetadataRoute } from 'next';
import { SITE_METADATA } from '@/lib/constants';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        // Only block the admin UI — the /api namespace must remain open so
        // that sitemap.xml, feed.xml and /doc are reachable by crawlers and
        // RSS readers even when the public API lives under the /api prefix.
        disallow: ['/admin/'],
      },
    ],
    sitemap: `${env.NEXT_PUBLIC_API_URL}/sitemap.xml`,
    host: SITE_METADATA.url,
  };
}
