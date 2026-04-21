import { Footer } from './Footer';
import { Header } from './Header';

interface PublicShellProps {
  activeHref: string;
  children: React.ReactNode;
}

/**
 * Server-owned public chrome.
 *
 * Renders the skip link, sticky header (with server-known active nav item),
 * page main area, and footer. Each public section layout instantiates this
 * component with a static `activeHref` that matches the section's root path,
 * so the navbar active state is correct in the initial HTML without any
 * client-side pathname hook.
 */
export function PublicShell({ activeHref, children }: PublicShellProps) {
  return (
    <div className="flex flex-col min-h-screen">
      {/* Skip navigation link for keyboard / screen reader users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-100 focus:px-4 focus:py-2 focus:bg-emerald-500 focus:text-zinc-950 focus:rounded-md focus:font-medium"
      >
        Ir para o conteúdo principal
      </a>

      {/* Header is fully server-rendered with known active href — no Suspense
          boundary needed, no history-patching hook required. */}
      <Header activeHref={activeHref} />

      <main id="main-content" className="flex-1">
        {children}
      </main>

      <Footer />
    </div>
  );
}
