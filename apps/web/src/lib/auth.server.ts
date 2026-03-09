import 'server-only';
import { cookies } from 'next/headers';

/**
 * Validate the admin session server-side before rendering protected chrome.
 *
 * Probes the API's /auth/session endpoint with the current admin_token cookie.
 * Returns `true` only when the API confirms the token is valid and unexpired.
 *
 * This is a UX-layer guard — the API authAdmin middleware remains the
 * authoritative security boundary for every subsequent data request.
 */
export async function validateAdminSession(): Promise<boolean> {
  const cookieStore = await cookies();
  const token = cookieStore.get('admin_token');

  if (!token?.value) return false;

  const baseUrl = (process.env.API_INTERNAL_URL || process.env.NEXT_PUBLIC_API_URL)?.replace(
    /\/+$/,
    ''
  );

  if (!baseUrl) return false;

  try {
    const res = await fetch(`${baseUrl}/auth/session`, {
      method: 'GET',
      headers: {
        Cookie: `admin_token=${token.value}`,
      },
      // Never cache — this must reflect the current token validity
      cache: 'no-store',
    });

    return res.ok;
  } catch {
    // API unreachable — fail closed to avoid rendering the admin shell with
    // an invalid session that will produce 401s on every data request.
    return false;
  }
}
