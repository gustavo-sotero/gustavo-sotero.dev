import {
  type ApiError,
  type ApiResponse,
  ERROR_CODES,
  type ErrorCode,
  type PaginatedResponse,
} from '@portfolio/shared';
import { env } from './env';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isErrorCode(value: unknown): value is ErrorCode {
  return typeof value === 'string' && value in ERROR_CODES;
}

function normalizeApiError(payload: unknown, statusText: string): ApiError {
  if (
    isRecord(payload) &&
    payload.success === false &&
    isRecord(payload.error) &&
    typeof payload.error.code === 'string' &&
    typeof payload.error.message === 'string'
  ) {
    const details = Array.isArray(payload.error.details)
      ? payload.error.details.filter(
          (detail): detail is { field?: string; message: string } =>
            isRecord(detail) &&
            typeof detail.message === 'string' &&
            (detail.field === undefined || typeof detail.field === 'string')
        )
      : undefined;

    return {
      success: false,
      error: {
        code: isErrorCode(payload.error.code) ? payload.error.code : 'INTERNAL_ERROR',
        message: payload.error.message,
        details,
      },
    };
  }

  return {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: statusText || 'Unexpected API error',
    },
  };
}

function getCsrfToken(): string | undefined {
  if (typeof document === 'undefined') return undefined;
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith('csrf_token='))
    ?.split('=')[1];
}

function handleUnauthorized(path: string, status: number): void {
  if (status !== 401 || typeof window === 'undefined') return;
  if (!path.startsWith('/admin')) return;
  if (window.location.pathname === '/admin/login') return;
  window.location.replace('/admin/login');
}

/**
 * Internal single-path HTTP executor shared by all public API helpers.
 *
 * Handles: URL construction, method normalisation, Content-Type, CSRF header
 * injection for mutating methods, credentials, and error normalisation.
 * Throws a normalised `ApiError` on any non-2xx response so callers can rely
 * on a consistent error shape.
 */
async function performRequest(path: string, options: RequestInit = {}): Promise<Response> {
  const url = `${env.NEXT_PUBLIC_API_URL}${path}`;
  const method = options.method?.toUpperCase() ?? 'GET';
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const csrf = getCsrfToken();
    if (csrf) headers['X-CSRF-Token'] = csrf;
  }

  const res = await fetch(url, {
    ...options,
    method,
    headers,
    credentials: 'include',
  });

  if (!res.ok) {
    handleUnauthorized(path, res.status);
    const payload = await res.json().catch(() => null);
    throw normalizeApiError(payload, res.statusText);
  }

  return res;
}

export async function apiFetch<T>(
  path: string,
  options: RequestInit = {}
): Promise<ApiResponse<T> | undefined> {
  const res = await performRequest(path, options);

  if (res.status === 204) {
    return undefined;
  }

  return res.json() as Promise<ApiResponse<T>>;
}

/**
 * Like `apiFetch` but explicitly handles empty-body responses (HTTP 204).
 * Use this for DELETE endpoints that return no payload.
 */
export async function apiFetchVoid(path: string, options: RequestInit = {}): Promise<void> {
  await performRequest(path, { method: 'DELETE', ...options });
  // Intentionally ignore body — caller expects no data (204 No Content)
}

export async function apiFetchPaginated<T>(
  path: string,
  options: RequestInit = {}
): Promise<PaginatedResponse<T>> {
  const res = await performRequest(path, options);
  return res.json();
}

export const apiGet = <T>(path: string, init?: RequestInit) =>
  apiFetch<T>(path, { ...init, method: 'GET' });

export const apiGetPaginated = <T>(path: string, init?: RequestInit) =>
  apiFetchPaginated<T>(path, { ...init, method: 'GET' });

export const apiPost = <T>(path: string, body: unknown, init?: RequestInit) =>
  apiFetch<T>(path, { ...init, method: 'POST', body: JSON.stringify(body) });

export const apiPatch = <T>(path: string, body: unknown, init?: RequestInit) =>
  apiFetch<T>(path, { ...init, method: 'PATCH', body: JSON.stringify(body) });

export const apiPut = <T>(path: string, body: unknown, init?: RequestInit) =>
  apiFetch<T>(path, { ...init, method: 'PUT', body: JSON.stringify(body) });

/** DELETE request — expects no response body (HTTP 204). */
export const apiDelete = (path: string, init?: RequestInit) =>
  apiFetchVoid(path, { ...init, method: 'DELETE' });
