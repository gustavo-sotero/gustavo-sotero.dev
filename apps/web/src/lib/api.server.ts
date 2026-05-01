import 'server-only';
import type { ApiError, ApiResponse, PaginatedResponse } from '@portfolio/shared';
import { resolveServerApiBaseUrl } from '@/lib/api-base-url.server';

/** Thrown when the API responds with HTTP 404. */
export class ApiNotFoundError extends Error {
  constructor(path: string) {
    super(`Not found: ${path}`);
    this.name = 'ApiNotFoundError';
  }
}

/** Thrown when the API responds with a non-2xx, non-404 status. Preserves code and status. */
export class ApiResponseError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: ApiError['error']['details'];

  constructor(
    status: number,
    code: string,
    message: string,
    details?: ApiError['error']['details']
  ) {
    super(message);
    this.name = 'ApiResponseError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

/** Thrown when the upstream API does not respond within the deadline. */
export class ApiTimeoutError extends Error {
  constructor(path: string, timeoutMs: number) {
    super(`API request timed out after ${timeoutMs}ms: ${path}`);
    this.name = 'ApiTimeoutError';
  }
}

/**
 * Default server-side fetch deadline.
 * Generous enough for cold-start DB queries; strict enough to not stall SSR.
 */
const DEFAULT_SERVER_TIMEOUT_MS = 10_000;

/**
 * Wraps `fetch` with an `AbortController`-based timeout.
 * Throws `ApiTimeoutError` when the deadline is exceeded.
 */
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      throw new ApiTimeoutError(url, timeoutMs);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

async function parseResponse<T>(res: Response, path: string): Promise<T> {
  if (res.status === 404) throw new ApiNotFoundError(path);
  if (!res.ok) {
    let message = `API error ${res.status}: ${res.statusText}`;
    let code = 'INTERNAL_ERROR';
    let details: ApiError['error']['details'];
    try {
      const body = (await res.json()) as {
        error?: { message?: string; code?: string; details?: ApiError['error']['details'] };
      };
      if (body?.error?.message) message = body.error.message;
      if (body?.error?.code) code = body.error.code;
      if (Array.isArray(body?.error?.details)) {
        details = body.error.details.filter(
          (detail): detail is NonNullable<ApiError['error']['details']>[number] =>
            typeof detail === 'object' &&
            detail !== null &&
            typeof detail.message === 'string' &&
            (detail.field === undefined || typeof detail.field === 'string')
        );
      }
    } catch {
      /* ignore parse error */
    }
    throw new ApiResponseError(res.status, code, message, details);
  }
  return res.json() as Promise<T>;
}

/**
 * Fetch a single resource from the public API.
 * Returns the unwrapped `data` field from `ApiResponse<T>`.
 * Throws `ApiNotFoundError` on 404, `ApiTimeoutError` on deadline exceeded.
 */
export async function apiServerGet<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<T> {
  const { timeoutMs = DEFAULT_SERVER_TIMEOUT_MS, ...fetchInit } = init ?? {};
  const url = `${resolveServerApiBaseUrl()}${path}`;
  const res = await fetchWithTimeout(url, { ...fetchInit, method: 'GET' }, timeoutMs);
  const payload = await parseResponse<ApiResponse<T>>(res, path);
  return payload.data;
}

/**
 * Fetch a paginated list from the public API.
 * Returns the full `PaginatedResponse<T>` (data + meta).
 * Throws `ApiNotFoundError` on 404, `ApiTimeoutError` on deadline exceeded.
 */
export async function apiServerGetPaginated<T>(
  path: string,
  init?: RequestInit & { timeoutMs?: number }
): Promise<PaginatedResponse<T>> {
  const { timeoutMs = DEFAULT_SERVER_TIMEOUT_MS, ...fetchInit } = init ?? {};
  const url = `${resolveServerApiBaseUrl()}${path}`;
  const res = await fetchWithTimeout(url, { ...fetchInit, method: 'GET' }, timeoutMs);
  return parseResponse<PaginatedResponse<T>>(res, path);
}
