import type { ReactNode } from 'react';

/**
 * Admin layout — nested under the root layout (app/layout.tsx) which owns
 * the HTML shell, CSS, fonts and Providers. This layout intentionally renders
 * no extra wrapper so AdminShell owns the admin-specific chrome and landmarks.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
