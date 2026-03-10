/**
 * Unit tests for apps/web/src/lib/env.ts
 *
 * The module validates NEXT_PUBLIC_* environment variables at import time
 * and calls process.exit(1) on failure. We use vi.resetModules() +
 * dynamic import to test each scenario in isolation.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const VALID_ENV = {
  NEXT_PUBLIC_API_URL: 'https://api.example.com',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'test-site-key',
  NEXT_PUBLIC_S3_PUBLIC_DOMAIN: 'https://cdn.example.com',
};

describe('env validation', () => {
  let originalEnv: NodeJS.ProcessEnv;
  let exitSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    originalEnv = { ...process.env };
    // Prevent process.exit from actually exiting the test runner
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`process.exit(${_code})`);
    });
  });

  afterEach(() => {
    process.env = originalEnv;
    exitSpy.mockRestore();
    vi.resetModules();
  });

  it('exports validated env object when all vars are valid URLs', async () => {
    process.env.NEXT_PUBLIC_API_URL = VALID_ENV.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = VALID_ENV.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN = VALID_ENV.NEXT_PUBLIC_S3_PUBLIC_DOMAIN;

    const { env } = await import('./env');

    expect(env.NEXT_PUBLIC_API_URL).toBe(VALID_ENV.NEXT_PUBLIC_API_URL);
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe(VALID_ENV.NEXT_PUBLIC_TURNSTILE_SITE_KEY);
    expect(env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN).toBe(VALID_ENV.NEXT_PUBLIC_S3_PUBLIC_DOMAIN);
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('calls process.exit(1) when NEXT_PUBLIC_API_URL is missing', async () => {
    delete process.env.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = VALID_ENV.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN = VALID_ENV.NEXT_PUBLIC_S3_PUBLIC_DOMAIN;

    await expect(import('./env')).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('calls process.exit(1) when NEXT_PUBLIC_API_URL is not a valid URL', async () => {
    process.env.NEXT_PUBLIC_API_URL = 'not-a-url';
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = VALID_ENV.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN = VALID_ENV.NEXT_PUBLIC_S3_PUBLIC_DOMAIN;

    await expect(import('./env')).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('calls process.exit(1) when NEXT_PUBLIC_TURNSTILE_SITE_KEY is missing', async () => {
    process.env.NEXT_PUBLIC_API_URL = VALID_ENV.NEXT_PUBLIC_API_URL;
    delete process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN = VALID_ENV.NEXT_PUBLIC_S3_PUBLIC_DOMAIN;

    await expect(import('./env')).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('calls process.exit(1) when NEXT_PUBLIC_S3_PUBLIC_DOMAIN is missing', async () => {
    process.env.NEXT_PUBLIC_API_URL = VALID_ENV.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = VALID_ENV.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    delete process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN;

    await expect(import('./env')).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('calls process.exit(1) when NEXT_PUBLIC_S3_PUBLIC_DOMAIN is not a valid URL', async () => {
    process.env.NEXT_PUBLIC_API_URL = VALID_ENV.NEXT_PUBLIC_API_URL;
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = VALID_ENV.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    // Plain hostname without protocol — valid for min(1) but invalid for url()
    process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN = 'cdn.example.com';

    await expect(import('./env')).rejects.toThrow('process.exit(1)');
    expect(exitSpy).toHaveBeenCalledWith(1);
  });
});
