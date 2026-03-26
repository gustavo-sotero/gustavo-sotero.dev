import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { type ReactNode, Suspense } from 'react';
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
export async function ProtectedAdminGate({ children }: { children: ReactNode }) {
  // connection() opts this guard into request-connected rendering without
  // forcing the entire layout tree to block outside a Suspense boundary.
  await connection();

  const isValid = await validateAdminSession();

  if (!isValid) {
    redirect('/admin/login');
  }

  return <AdminShell>{children}</AdminShell>;
}

function AdminRoutePendingState() {
  return <div className="min-h-screen" aria-hidden />;
}

export default function ProtectedAdminLayout({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<AdminRoutePendingState />}>
      <ProtectedAdminGate>{children}</ProtectedAdminGate>
    </Suspense>
  );
}
