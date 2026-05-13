import { beforeEach, describe, expect, it, vi } from 'vitest';

const cookiesMock = vi.fn();
const fetchMock = vi.fn();

vi.mock('server-only', () => ({}));
vi.mock('next/headers', () => ({
  cookies: (...args: Parameters<typeof cookiesMock>) => cookiesMock(...args),
}));

vi.stubGlobal('fetch', fetchMock);

const { validateAdminSession } = await import('./auth.server');

function makeResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: {
      'content-type': 'application/json',
    },
  });
}

function expectSessionValidationRequest(url: string, token: string): void {
  expect(fetchMock).toHaveBeenCalledWith(
    url,
    expect.objectContaining({
      method: 'GET',
      cache: 'no-store',
      signal: expect.any(AbortSignal),
      headers: expect.any(Headers),
    })
  );

  const requestInit = fetchMock.mock.calls.at(-1)?.[1] as RequestInit | undefined;
  expect(requestInit?.headers).toBeInstanceOf(Headers);

  const headers = requestInit?.headers as Headers;
  expect(headers.get('Cookie')).toBe(`admin_token=${token}`);
  expect(headers.get('Accept')).toBe('application/json');
}

describe('validateAdminSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.API_INTERNAL_URL;
    delete process.env.NEXT_PUBLIC_API_URL;
  });

  it('returns false when admin_token cookie is missing', async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });

    const result = await validateAdminSession();

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns false when no API base URL is configured', async () => {
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'token-value' }),
    });

    const result = await validateAdminSession();

    expect(result).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns true when /auth/session responds with 200', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'https://example.com/api/';
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'valid-token' }),
    });
    fetchMock.mockResolvedValue(
      makeResponse(200, { success: true, data: { adminId: 'valid-admin' } })
    );

    const result = await validateAdminSession();

    expect(result).toBe(true);
    expectSessionValidationRequest('https://example.com/api/auth/session', 'valid-token');
  });

  it('returns false when /auth/session responds with non-2xx', async () => {
    process.env.API_INTERNAL_URL = 'http://api:3000';
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'expired-token' }),
    });
    fetchMock.mockResolvedValue(
      makeResponse(401, {
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          type: 'unauthorized',
          message: 'Invalid token',
        },
      })
    );

    const result = await validateAdminSession();

    expect(result).toBe(false);
  });

  it('returns false when API is unreachable', async () => {
    process.env.API_INTERNAL_URL = 'http://api:3000';
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'token' }),
    });
    fetchMock.mockRejectedValue(new Error('network down'));

    const result = await validateAdminSession();

    expect(result).toBe(false);
  });

  it('returns false when /auth/session times out', async () => {
    process.env.API_INTERNAL_URL = 'http://api:3000';
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'slow-token' }),
    });
    fetchMock.mockRejectedValue(Object.assign(new Error('aborted'), { name: 'AbortError' }));

    const result = await validateAdminSession();

    expect(result).toBe(false);
  });

  // ── Path-based topology ────────────────────────────────────────────────────

  it('calls /auth/session at the path-based public URL when API_INTERNAL_URL is absent', async () => {
    delete process.env.API_INTERNAL_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://example.com/api';
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'path-based-token' }),
    });
    fetchMock.mockResolvedValue(
      makeResponse(200, { success: true, data: { adminId: 'path-admin' } })
    );

    const result = await validateAdminSession();

    expect(result).toBe(true);
    expectSessionValidationRequest('https://example.com/api/auth/session', 'path-based-token');
  });

  it('prefers API_INTERNAL_URL over path-based NEXT_PUBLIC_API_URL', async () => {
    process.env.API_INTERNAL_URL = 'http://api:3000';
    process.env.NEXT_PUBLIC_API_URL = 'https://example.com/api';
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'internal-token' }),
    });
    fetchMock.mockResolvedValue(
      makeResponse(200, { success: true, data: { adminId: 'internal-admin' } })
    );

    const result = await validateAdminSession();

    expect(result).toBe(true);
    expectSessionValidationRequest('http://api:3000/auth/session', 'internal-token');
  });
});
