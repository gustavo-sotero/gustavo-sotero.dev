import type { ReactNode } from 'react';

/**
 * Admin root layout — overlays the public Header/Footer from the root layout
 * using a fixed full-screen container.
 */
export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-40 bg-zinc-950 overflow-hidden flex flex-col">{children}</div>
  );
}
