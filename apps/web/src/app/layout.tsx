import type { ReactNode } from 'react';
import './globals.css';
import { Toaster } from 'sonner';
import { jetbrainsMono, sora } from './fonts';

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
 *
 * QueryClientProvider is mounted in (admin)/layout.tsx only — public routes
 * do not need it and should not pay the hydration cost.
 */
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body className={`${sora.variable} ${jetbrainsMono.variable} font-sans antialiased`}>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            classNames: {
              toast: 'bg-zinc-900 border border-zinc-800 text-zinc-100',
              description: 'text-zinc-400',
              actionButton: 'bg-emerald-500 text-zinc-950',
              cancelButton: 'bg-zinc-800 text-zinc-400',
              error: 'border-red-500/40',
              success: 'border-emerald-500/40',
            },
          }}
        />
      </body>
    </html>
  );
}
