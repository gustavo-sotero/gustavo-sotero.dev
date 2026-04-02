import type { ReactNode } from 'react';
import { AdminProviders } from './providers';

/**
 * Admin layout — wraps all admin routes with the admin-specific QueryClient
 * provider (unauthorized redirect, stale time, retry). Public routes are
 * intentionally excluded from this boundary.
 */
export default function AdminRootLayout({ children }: { children: ReactNode }) {
  return <AdminProviders>{children}</AdminProviders>;
}
