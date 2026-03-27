import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

describe('resolveServerApiBaseUrl', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let errorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  afterEach(() => {
    process.env = originalEnv;
    errorSpy.mockRestore();
    vi.resetModules();
  });

  it('prefers API_INTERNAL_URL over NEXT_PUBLIC_API_URL', async () => {
    process.env.API_INTERNAL_URL = 'http://api:3000/';
    process.env.NEXT_PUBLIC_API_URL = 'https://example.com/api/';

    const { resolveServerApiBaseUrl } = await import('./api-base-url.server');

    expect(resolveServerApiBaseUrl()).toBe('http://api:3000');
  });

  it('falls back to NEXT_PUBLIC_API_URL when API_INTERNAL_URL is missing', async () => {
    delete process.env.API_INTERNAL_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://example.com/api/';

    const { resolveServerApiBaseUrl } = await import('./api-base-url.server');

    expect(resolveServerApiBaseUrl()).toBe('https://example.com/api');
  });

  it('throws when NEXT_PUBLIC_API_URL is missing', async () => {
    delete process.env.API_INTERNAL_URL;
    delete process.env.NEXT_PUBLIC_API_URL;

    const { resolveServerApiBaseUrl } = await import('./api-base-url.server');

    expect(() => resolveServerApiBaseUrl()).toThrow('Invalid API base URL environment variables');
    expect(errorSpy).toHaveBeenCalled();
  });

  it('throws when API_INTERNAL_URL is invalid', async () => {
    process.env.API_INTERNAL_URL = 'not-a-url';
    process.env.NEXT_PUBLIC_API_URL = 'https://example.com/api';

    const { resolveServerApiBaseUrl } = await import('./api-base-url.server');

    expect(() => resolveServerApiBaseUrl()).toThrow('Invalid API base URL environment variables');
    expect(errorSpy).toHaveBeenCalled();
  });

  // ── Path-based topology ────────────────────────────────────────────────────

  it('supports path-based public URL (https://example.com/api) as NEXT_PUBLIC_API_URL', async () => {
    delete process.env.API_INTERNAL_URL;
    process.env.NEXT_PUBLIC_API_URL = 'https://example.com/api';

    const { resolveServerApiBaseUrl } = await import('./api-base-url.server');

    expect(resolveServerApiBaseUrl()).toBe('https://example.com/api');
  });

  it('still prefers API_INTERNAL_URL even when public URL is path-based', async () => {
    process.env.API_INTERNAL_URL = 'http://api:3000';
    process.env.NEXT_PUBLIC_API_URL = 'https://example.com/api';

    const { resolveServerApiBaseUrl } = await import('./api-base-url.server');

    // SSR always uses direct internal URL — the /api prefix only exists at the public proxy layer
    expect(resolveServerApiBaseUrl()).toBe('http://api:3000');
  });
});
