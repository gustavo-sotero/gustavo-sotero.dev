import { redirect } from 'next/navigation';
import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin/AdminShell';
import { validateAdminSession } from '@/lib/auth.server';

/**
 * Protected admin layout — validates the admin session server-side before
 * rendering the shell. A valid JWT signed by the API is required; cookie
 * presence alone is not sufficient.
 *
 * Security model:
 *   - This guard prevents the admin shell from rendering on stale/invalid tokens.
 *   - The API authAdmin middleware remains the authoritative authorization layer
 *     for every subsequent data request within the shell.
 */
export default async function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  const isValid = await validateAdminSession();

  if (!isValid) {
    redirect('/admin/login');
  }

  return <AdminShell>{children}</AdminShell>;
}
