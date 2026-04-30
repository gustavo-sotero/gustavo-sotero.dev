import 'server-only';
import { cookies } from 'next/headers';
import { resolveServerApiBaseUrl } from '@/lib/api-base-url.server';

/** Session validation deadline — keeps SSR from stalling on a hung API. */
const SESSION_CHECK_TIMEOUT_MS = 5_000;

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

  let baseUrl: string;
  try {
    baseUrl = resolveServerApiBaseUrl();
  } catch {
    return false;
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), SESSION_CHECK_TIMEOUT_MS);

  try {
    const res = await fetch(`${baseUrl}/auth/session`, {
      method: 'GET',
      headers: {
        Cookie: `admin_token=${token.value}`,
      },
      // Never cache — this must reflect the current token validity
      cache: 'no-store',
      signal: controller.signal,
    });

    return res.ok;
  } catch {
    // API unreachable or timed out — fail closed to avoid rendering the admin
    // shell with an invalid session that will produce 401s on every data request.
    return false;
  } finally {
    clearTimeout(timer);
  }
}
