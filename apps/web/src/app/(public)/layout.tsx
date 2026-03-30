import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Footer } from '@/components/layout/Footer';
import { Header } from '@/components/layout/Header';
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

export default function PublicLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    // flex column shell so the footer is pushed to the bottom on short pages.
    // <html> and <body> are owned by the root layout (app/layout.tsx).
    <div className="flex flex-col min-h-screen">
      {/* Skip navigation link for keyboard / screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:px-4 focus:py-2 focus:bg-emerald-500 focus:text-zinc-950 focus:rounded-md focus:font-medium"
      >
        Ir para o conteúdo principal
      </a>
      {/* Header wrapped in Suspense: NavLinks uses usePathname() which is
          a dynamic API in Cache Components mode. Suspense allows the build
          to prerender the page shell while deferring path-dependent rendering. */}
      <Suspense fallback={null}>
        <Header />
      </Suspense>
      <main id="main-content" className="flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
