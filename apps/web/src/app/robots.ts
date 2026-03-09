import type { MetadataRoute } from 'next';
import { SITE_METADATA } from '@/lib/constants';
import { env } from '@/lib/env';

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/'],
      },
    ],
    sitemap: `${env.NEXT_PUBLIC_API_URL}/sitemap.xml`,
    host: SITE_METADATA.url,
  };
}
