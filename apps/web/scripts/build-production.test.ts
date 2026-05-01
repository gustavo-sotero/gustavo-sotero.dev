import { describe, expect, it } from 'vitest';
import { BUILD_ENV_DEFAULTS, resolveProductionBuildEnv } from './build-production';

describe('resolveProductionBuildEnv', () => {
  it('keeps valid public production URLs and provided secrets', () => {
    const { env, overriddenKeys } = resolveProductionBuildEnv({
      NODE_ENV: 'development',
      NEXT_PUBLIC_API_URL: 'https://api.example.com',
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'site-key',
      NEXT_PUBLIC_S3_PUBLIC_DOMAIN: 'https://cdn.example.com',
      REVALIDATE_SECRET: 'secret',
    });

    expect(env.NODE_ENV).toBe('production');
    expect(env.NEXT_PUBLIC_API_URL).toBe('https://api.example.com');
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe('site-key');
    expect(env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN).toBe('https://cdn.example.com');
    expect(env.REVALIDATE_SECRET).toBe('secret');
    expect(overriddenKeys).toEqual([]);
  });

  it('replaces insecure or missing public values with smoke-build defaults', () => {
    const { env, overriddenKeys } = resolveProductionBuildEnv({
      NODE_ENV: 'development',
      NEXT_PUBLIC_API_URL: 'http://localhost:3000',
      NEXT_PUBLIC_S3_PUBLIC_DOMAIN: 'http://localhost:9000',
    });

    expect(env.NEXT_PUBLIC_API_URL).toBe(BUILD_ENV_DEFAULTS.NEXT_PUBLIC_API_URL);
    expect(env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN).toBe(BUILD_ENV_DEFAULTS.NEXT_PUBLIC_S3_PUBLIC_DOMAIN);
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe(
      BUILD_ENV_DEFAULTS.NEXT_PUBLIC_TURNSTILE_SITE_KEY
    );
    expect(env.REVALIDATE_SECRET).toBe(BUILD_ENV_DEFAULTS.REVALIDATE_SECRET);
    expect(overriddenKeys).toEqual([
      'NEXT_PUBLIC_API_URL',
      'NEXT_PUBLIC_TURNSTILE_SITE_KEY',
      'NEXT_PUBLIC_S3_PUBLIC_DOMAIN',
      'REVALIDATE_SECRET',
    ]);
  });
});
