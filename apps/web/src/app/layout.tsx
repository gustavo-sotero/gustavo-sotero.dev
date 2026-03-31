import type { ReactNode } from 'react';
import './globals.css';
import { jetbrainsMono, sora } from './fonts';
import { Providers } from './providers';

/**
 * Root layout — owns the single HTML/body shell for the entire app.
 *
 * Route group layouts ((public) and (admin)) are nested layouts that add
 * group-specific chrome. This guarantees that root-level special files like
 * not-found.tsx always render inside a proper HTML document with CSS and fonts.
 *
 * suppressHydrationWarning is required because next-themes injects the resolved
 * theme class ('dark'/'light') on the server. The brief mismatch before
 * hydration is intentional and safe for this attribute only.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${sora.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
