import { JetBrains_Mono, Sora } from 'next/font/google';
import type { ReactNode } from 'react';
import '../globals.css';
import { Providers } from '../providers';

const sora = Sora({
  variable: '--font-sora',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  variable: '--font-mono-jetbrains',
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap',
});

/**
 * Admin root layout — owns the full HTML shell for all /admin routes.
 *
 * Intentionally does NOT render the public Header, Footer, skip-link or
 * <main> landmark. AdminShell (rendered by the protected gate) owns the
 * admin-specific chrome and landmarks.
 *
 * Navigating from a public page to an admin page (or vice-versa) triggers
 * a full page reload because the two route groups have separate root layouts.
 * This is an accepted tradeoff for correct landmark isolation.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return (
    // suppressHydrationWarning keeps next-themes class injection silent.
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${sora.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
