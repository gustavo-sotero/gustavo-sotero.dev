import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Mock env before importing api to prevent Zod env-validation from failing in tests
vi.mock('./env', () => ({
  env: {
    NEXT_PUBLIC_API_URL: 'https://example.com/api',
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'test-key',
    NEXT_PUBLIC_S3_PUBLIC_DOMAIN: 'https://s3.example.com',
  },
}));

// Mock @portfolio/shared to avoid resolution issues in Vitest
vi.mock('@portfolio/shared', () => ({
  ERROR_CODES: {
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    UNAUTHORIZED: 'UNAUTHORIZED',
    FORBIDDEN: 'FORBIDDEN',
    NOT_FOUND: 'NOT_FOUND',
    CONFLICT: 'CONFLICT',
    RATE_LIMITED: 'RATE_LIMITED',
    SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
    INTERNAL_ERROR: 'INTERNAL_ERROR',
  },
}));

vi.mock('@portfolio/shared/constants/httpMethods', () => ({
  MUTATING_HTTP_METHODS: ['POST', 'PUT', 'PATCH', 'DELETE'],
  isMutatingHttpMethod: (method: string) => ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method),
}));

import { apiFetch, apiFetchPaginated, apiFetchVoid } from './api';

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  const json = body !== null ? JSON.stringify(body) : null;
  const init: ResponseInit = {
    status,
    statusText: status === 200 ? 'OK' : status === 204 ? 'No Content' : 'Error',
    headers: {
      'content-type': json !== null ? 'application/json' : 'text/plain',
      ...headers,
    },
  };
  return new Response(json, init);
}

describe('apiFetch', () => {
  beforeEach(() => {
    // Reset document.cookie between tests
    Object.defineProperty(document, 'cookie', {
      writable: true,
      value: '',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns parsed JSON for a successful 200 response', async () => {
    const payload = { success: true, data: { id: 1, title: 'Test' } };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeResponse(200, payload));

    const result = await apiFetch<{ id: number; title: string }>('/posts/test');

    expect(result).toEqual(payload);
  });

  it('throws a normalized ApiError for a 404 response', async () => {
    const errorPayload = {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeResponse(404, errorPayload));

    await expect(apiFetch('/posts/missing')).rejects.toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND', message: 'Resource not found' },
    });
  });

  it('throws an INTERNAL_ERROR ApiError when error payload is malformed', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeResponse(500, null));

    await expect(apiFetch('/posts/broken')).rejects.toMatchObject({
      success: false,
      error: { code: 'INTERNAL_ERROR' },
    });
  });

  it('injects X-CSRF-Token header for POST requests when csrf_token cookie is set', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom test environment — Cookie Store API not available
    document.cookie = 'csrf_token=test-csrf-token-xyz';

    const capturedHeaders: Record<string, string> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      Object.assign(capturedHeaders, headers);
      return makeResponse(200, { success: true, data: {} });
    });

    await apiFetch('/admin/posts', {
      method: 'POST',
      body: JSON.stringify({ title: 'Test' }),
    });

    expect(capturedHeaders['X-CSRF-Token']).toBe('test-csrf-token-xyz');
  });

  it('injects X-CSRF-Token header for PUT requests when csrf_token cookie is set', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom test environment — Cookie Store API not available
    document.cookie = 'csrf_token=test-csrf-token-put';

    const capturedHeaders: Record<string, string> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      Object.assign(capturedHeaders, headers);
      return makeResponse(200, { success: true, data: {} });
    });

    await apiFetch('/admin/posts/generate/config', {
      method: 'PUT',
      body: JSON.stringify({ topicsModelId: 'model-a', draftModelId: 'model-b' }),
    });

    expect(capturedHeaders['X-CSRF-Token']).toBe('test-csrf-token-put');
  });

  it('does not inject X-CSRF-Token header for GET requests', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom test environment — Cookie Store API not available
    document.cookie = 'csrf_token=test-csrf-token-xyz';

    const capturedHeaders: Record<string, string> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      Object.assign(capturedHeaders, headers);
      return makeResponse(200, { success: true, data: {} });
    });

    await apiFetch('/posts', { method: 'GET' });

    expect(capturedHeaders['X-CSRF-Token']).toBeUndefined();
  });

  it('includes credentials: include on all requests', async () => {
    let capturedInit: RequestInit | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      capturedInit = init;
      return makeResponse(200, { success: true, data: {} });
    });

    await apiFetch('/posts');

    expect(capturedInit?.credentials).toBe('include');
  });

  it('builds the full URL from NEXT_PUBLIC_API_URL + path', async () => {
    let capturedUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
      capturedUrl = String(url);
      return makeResponse(200, { success: true, data: {} });
    });

    await apiFetch('/posts/my-slug');

    expect(capturedUrl).toBe('https://example.com/api/posts/my-slug');
  });
});

describe('apiFetchVoid', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves without a value for a 204 No Content response', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      new Response(null, { status: 204, statusText: 'No Content' })
    );

    const result = await apiFetchVoid('/admin/posts/1', { method: 'DELETE' });

    expect(result).toBeUndefined();
  });

  it('throws a normalized ApiError for non-ok responses', async () => {
    const errorPayload = {
      success: false,
      error: { code: 'NOT_FOUND', message: 'Not found' },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeResponse(404, errorPayload));

    await expect(apiFetchVoid('/admin/posts/999', { method: 'DELETE' })).rejects.toMatchObject({
      success: false,
      error: { code: 'NOT_FOUND' },
    });
  });

  it('injects X-CSRF-Token for DELETE requests', async () => {
    // biome-ignore lint/suspicious/noDocumentCookie: jsdom test environment — Cookie Store API not available
    document.cookie = 'csrf_token=delete-csrf';

    const capturedHeaders: Record<string, string> = {};
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      const headers = init?.headers as Record<string, string>;
      Object.assign(capturedHeaders, headers);
      return new Response(null, { status: 204 });
    });

    await apiFetchVoid('/admin/posts/1', { method: 'DELETE' });

    expect(capturedHeaders['X-CSRF-Token']).toBe('delete-csrf');
  });
});

describe('apiFetchPaginated', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns the parsed paginated JSON body on success', async () => {
    const paginatedPayload = {
      success: true,
      data: [{ id: 1, title: 'Post A' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeResponse(200, paginatedPayload));

    const result = await apiFetchPaginated<{ id: number; title: string }>('/posts');

    expect(result).toEqual(paginatedPayload);
    expect(result.data).toHaveLength(1);
    expect(result.meta.totalPages).toBe(1);
  });

  it('throws a normalized ApiError for a non-ok response', async () => {
    const errorPayload = {
      success: false,
      error: { code: 'UNAUTHORIZED', message: 'Not authenticated' },
    };
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(makeResponse(401, errorPayload));

    await expect(apiFetchPaginated('/admin/posts')).rejects.toMatchObject({
      success: false,
      error: { code: 'UNAUTHORIZED' },
    });
  });

  it('builds the full URL from NEXT_PUBLIC_API_URL + path', async () => {
    let capturedUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
      capturedUrl = String(url);
      return makeResponse(200, {
        success: true,
        data: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });
    });

    await apiFetchPaginated('/posts?page=2&perPage=10');

    expect(capturedUrl).toBe('https://example.com/api/posts?page=2&perPage=10');
  });

  it('includes credentials: include', async () => {
    let capturedInit: RequestInit | undefined;
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (_url, init) => {
      capturedInit = init;
      return makeResponse(200, {
        success: true,
        data: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });
    });

    await apiFetchPaginated('/posts');

    expect(capturedInit?.credentials).toBe('include');
  });
});

// ── Path-based API URL topology ───────────────────────────────────────────────
// Verifies that all client helpers correctly concatenate paths when
// NEXT_PUBLIC_API_URL contains a path suffix (e.g. https://example.com/api).
describe('path-based API URL (https://example.com/api)', () => {
  let apiFetchPathBased: typeof import('./api').apiFetch;
  let apiFetchPaginatedPathBased: typeof import('./api').apiFetchPaginated;

  beforeEach(async () => {
    vi.resetModules();
    vi.doMock('./env', () => ({
      env: {
        NEXT_PUBLIC_API_URL: 'https://example.com/api',
        NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'test-key',
        NEXT_PUBLIC_S3_PUBLIC_DOMAIN: 'https://s3.example.com',
      },
    }));
    vi.doMock('@portfolio/shared', () => ({
      ERROR_CODES: {
        VALIDATION_ERROR: 'VALIDATION_ERROR',
        UNAUTHORIZED: 'UNAUTHORIZED',
        FORBIDDEN: 'FORBIDDEN',
        NOT_FOUND: 'NOT_FOUND',
        CONFLICT: 'CONFLICT',
        RATE_LIMITED: 'RATE_LIMITED',
        SERVICE_UNAVAILABLE: 'SERVICE_UNAVAILABLE',
        INTERNAL_ERROR: 'INTERNAL_ERROR',
      },
    }));
    const mod = await import('./api');
    apiFetchPathBased = mod.apiFetch;
    apiFetchPaginatedPathBased = mod.apiFetchPaginated;
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('builds URL with path prefix correctly for apiFetch', async () => {
    let capturedUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
      capturedUrl = String(url);
      return makeResponse(200, { success: true, data: { id: 1 } });
    });

    await apiFetchPathBased('/posts/my-slug');

    expect(capturedUrl).toBe('https://example.com/api/posts/my-slug');
  });

  it('builds URL with path prefix correctly for apiFetchPaginated', async () => {
    let capturedUrl = '';
    vi.spyOn(globalThis, 'fetch').mockImplementationOnce(async (url) => {
      capturedUrl = String(url);
      return makeResponse(200, {
        success: true,
        data: [],
        meta: { page: 1, perPage: 20, total: 0, totalPages: 0 },
      });
    });

    await apiFetchPaginatedPathBased('/posts?page=1');

    expect(capturedUrl).toBe('https://example.com/api/posts?page=1');
  });
});
