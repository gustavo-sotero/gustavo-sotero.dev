import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const fetchMock = vi.fn();
const originalFetch = globalThis.fetch;

vi.mock('server-only', () => ({}));

vi.mock('@/lib/api-base-url.server', () => ({
  resolveServerApiBaseUrl: () => 'https://example.com/api',
}));

const { ApiNotFoundError, ApiResponseError, ApiTimeoutError, apiServerGet, apiServerGetPaginated } =
  await import('./api.server');

function makeResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  const json = body !== null ? JSON.stringify(body) : null;
  return new Response(json, {
    status,
    statusText: status === 200 ? 'OK' : status === 404 ? 'Not Found' : 'Error',
    headers: {
      'content-type': json !== null ? 'application/json' : 'text/plain',
      ...headers,
    },
  });
}

describe('api.server', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(globalThis, 'fetch', {
      value: fetchMock,
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    if (originalFetch) {
      Object.defineProperty(globalThis, 'fetch', {
        value: originalFetch,
        configurable: true,
        writable: true,
      });
      return;
    }

    Reflect.deleteProperty(globalThis, 'fetch');
  });

  it('preserves status, code, message, and details on non-2xx responses', async () => {
    fetchMock.mockResolvedValueOnce(
      makeResponse(400, {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          type: 'validation',
          message: 'Validation failed',
          details: [{ field: 'title', message: 'Title is required' }],
        },
      })
    );

    const promise = apiServerGet('/posts');

    await expect(promise).rejects.toBeInstanceOf(ApiResponseError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      code: 'VALIDATION_ERROR',
      type: 'validation',
      message: 'Validation failed',
      details: [{ field: 'title', message: 'Title is required' }],
    });
  });

  it('throws ApiNotFoundError on 404 responses', async () => {
    fetchMock.mockResolvedValueOnce(makeResponse(404, null));
    const promise = apiServerGet('/posts/missing');

    await expect(promise).rejects.toBeInstanceOf(ApiNotFoundError);
    await expect(promise).rejects.toMatchObject({
      status: 404,
      code: 'NOT_FOUND',
      type: 'not_found',
      path: '/posts/missing',
    });
  });

  it('throws ApiTimeoutError when fetch aborts before the deadline', async () => {
    fetchMock.mockRejectedValueOnce(Object.assign(new Error('aborted'), { name: 'AbortError' }));
    const promise = apiServerGet('/slow', { timeoutMs: 10 });

    await expect(promise).rejects.toBeInstanceOf(ApiTimeoutError);
    await expect(promise).rejects.toMatchObject({
      status: 504,
      code: 'TIMEOUT',
      type: 'timeout',
      path: 'https://example.com/api/slow',
      timeoutMs: 10,
    });
  });

  it('returns paginated payloads unchanged on success', async () => {
    const payload = {
      success: true,
      data: [{ id: 1, title: 'Post A' }],
      meta: { page: 1, perPage: 20, total: 1, totalPages: 1 },
    };
    fetchMock.mockResolvedValueOnce(makeResponse(200, payload));

    await expect(apiServerGetPaginated('/posts')).resolves.toEqual(payload);
  });
});
