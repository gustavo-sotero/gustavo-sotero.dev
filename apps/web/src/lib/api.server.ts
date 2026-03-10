import 'server-only';
import type { ApiResponse, PaginatedResponse } from '@portfolio/shared';
import { resolveServerApiBaseUrl } from '@/lib/api-base-url.server';

/** Thrown when the API responds with HTTP 404. */
export class ApiNotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`);
    this.name = 'ApiNotFoundError';
  }
}

async function parseResponse<T>(res: Response, path: string): Promise<T> {
  if (res.status === 404) throw new ApiNotFoundError(path);
  if (!res.ok) {
    let message = `API error ${res.status}: ${res.statusText}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body?.error?.message) message = body.error.message;
    } catch {
      /* ignore parse error */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch a single resource from the public API.
 * Returns the unwrapped `data` field from `ApiResponse<T>`.
 * Throws `ApiNotFoundError` on 404.
 */
export async function apiServerGet<T>(path: string, init?: RequestInit): Promise<T> {
  const url = `${resolveServerApiBaseUrl()}${path}`;
  const res = await fetch(url, { ...init, method: 'GET' });
  const payload = await parseResponse<ApiResponse<T>>(res, path);
  return payload.data;
}

/**
 * Fetch a paginated list from the public API.
 * Returns the full `PaginatedResponse<T>` (data + meta).
 * Throws `ApiNotFoundError` on 404.
 */
export async function apiServerGetPaginated<T>(
  path: string,
  init?: RequestInit
): Promise<PaginatedResponse<T>> {
  const url = `${resolveServerApiBaseUrl()}${path}`;
  const res = await fetch(url, { ...init, method: 'GET' });
  return parseResponse<PaginatedResponse<T>>(res, path);
}
