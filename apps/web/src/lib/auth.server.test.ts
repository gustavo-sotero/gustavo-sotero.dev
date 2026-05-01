import { beforeEach, describe, expect, it, vi } from 'vitest';

const { cookiesMock, fetchMock } = vi.hoisted(() => ({
  cookiesMock: vi.fn(),
  fetchMock: vi.fn(),
}));

vi.mock('next/headers', () => ({
  cookies: cookiesMock,
}));

vi.stubGlobal('fetch', fetchMock);

const { validateAdminSession } = await import('./auth.server');

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
    fetchMock.mockResolvedValue({ ok: true });

    const result = await validateAdminSession();

    expect(result).toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/auth/session',
      expect.objectContaining({
        method: 'GET',
        headers: {
          Cookie: 'admin_token=valid-token',
        },
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('returns false when /auth/session responds with non-2xx', async () => {
    process.env.API_INTERNAL_URL = 'http://api:3000';
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'expired-token' }),
    });
    fetchMock.mockResolvedValue({ ok: false });

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

  // ── Path-based topology ────────────────────────────────────────────────────

  it('calls /auth/session at the path-based public URL when API_INTERNAL_URL is absent', async () => {
    delete process.env.API_INTERNAL_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://example.com/api';
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'path-based-token' }),
    });
    fetchMock.mockResolvedValue({ ok: true });

    const result = await validateAdminSession();

    expect(result).toBe(true);
    // resolveServerApiBaseUrl returns the path-based URL as-is (trailing slash stripped);
    // the fetch target must include /api before /auth/session.
    expect(fetchMock).toHaveBeenCalledWith(
      'https://example.com/api/auth/session',
      expect.objectContaining({
        method: 'GET',
        headers: { Cookie: 'admin_token=path-based-token' },
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      })
    );
  });

  it('prefers API_INTERNAL_URL over path-based NEXT_PUBLIC_API_URL', async () => {
    process.env.API_INTERNAL_URL = 'http://api:3000';
    process.env.NEXT_PUBLIC_API_URL = 'https://example.com/api';
    cookiesMock.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: 'internal-token' }),
    });
    fetchMock.mockResolvedValue({ ok: true });

    const result = await validateAdminSession();

    expect(result).toBe(true);
    // The internal URL wins — no /api prefix in the SSR request path.
    expect(fetchMock).toHaveBeenCalledWith(
      'http://api:3000/auth/session',
      expect.objectContaining({
        method: 'GET',
        headers: { Cookie: 'admin_token=internal-token' },
        cache: 'no-store',
        signal: expect.any(AbortSignal),
      })
    );
  });
});
