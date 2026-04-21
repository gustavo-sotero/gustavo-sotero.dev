import type { Metadata } from 'next';
import { SITE_METADATA } from '@/lib/constants';
import { env } from '@/lib/env';

export const metadata: Metadata = {
  title: {
    default: SITE_METADATA.title,
    template: `%s — ${SITE_METADATA.author}`,
  },
  description: SITE_METADATA.description,
  authors: [{ name: SITE_METADATA.author }],
  openGraph: {
    type: 'website',
    locale: 'pt_BR',
    siteName: SITE_METADATA.author,
    title: SITE_METADATA.title,
    description: SITE_METADATA.description,
  },
  twitter: {
    card: 'summary_large_image',
    title: SITE_METADATA.title,
    description: SITE_METADATA.description,
  },
  alternates: {
    types: {
      'application/rss+xml': `${env.NEXT_PUBLIC_API_URL}/feed.xml`,
    },
  },
};

/**
 * Thin route-group layout — owns only shared metadata.
 * The shell (skip-link, Header, main, Footer) is rendered by each section's
 * nested layout via PublicShell, which receives the server-owned activeHref.
 */
export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <>{children}</>;
}
