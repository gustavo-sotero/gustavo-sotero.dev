import { describe, expect, it, vi } from 'vitest';
import {
  BUILD_ENV_DEFAULTS,
  resolveProductionBuildCommand,
  resolveProductionBuildEnv,
  resolveProductionBuildMaxAttempts,
  shouldRetryProductionBuild,
} from './build-production';

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
    expect(env.NEXT_PHASE).toBe('phase-production-build');
    expect(env.NEXT_PUBLIC_API_URL).toBe('https://api.example.com');
    expect(env.NEXT_PUBLIC_TURNSTILE_SITE_KEY).toBe('site-key');
    expect(env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN).toBe('https://cdn.example.com');
    expect(env.REVALIDATE_SECRET).toBe('secret');
    expect(overriddenKeys).toEqual([]);
  });

  it('replaces insecure or missing public values with smoke-build defaults', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { env, overriddenKeys } = resolveProductionBuildEnv({
      NODE_ENV: 'development',
      NEXT_PUBLIC_API_URL: 'http://localhost:3000',
      NEXT_PUBLIC_S3_PUBLIC_DOMAIN: 'http://localhost:9000',
    });

    expect(env.NEXT_PHASE).toBe('phase-production-build');
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

describe('resolveProductionBuildCommand', () => {
  it('reuses the current Bun executable when already running under Bun', () => {
    expect(resolveProductionBuildCommand('C:/tools/bun.exe')).toEqual([
      'C:/tools/bun.exe',
      '--bun',
      'next',
      'build',
    ]);
  });

  it('falls back to the bun binary name when execPath is not Bun', () => {
    expect(resolveProductionBuildCommand('C:/Program Files/nodejs/node.exe')).toEqual([
      'bun',
      '--bun',
      'next',
      'build',
    ]);
  });
});

describe('production build retry policy', () => {
  it('retries once on Windows for transient Bun build exit codes', () => {
    expect(resolveProductionBuildMaxAttempts('win32')).toBe(2);
    expect(shouldRetryProductionBuild({ exitCode: 3, success: false }, 1, 2, 'win32')).toBe(true);
    expect(shouldRetryProductionBuild({ exitCode: 1, success: false }, 1, 2, 'win32')).toBe(true);
  });

  it('does not retry on non-Windows platforms or after the final attempt', () => {
    expect(resolveProductionBuildMaxAttempts('linux')).toBe(1);
    expect(shouldRetryProductionBuild({ exitCode: 3, success: false }, 1, 1, 'linux')).toBe(false);
    expect(shouldRetryProductionBuild({ exitCode: 3, success: false }, 2, 2, 'win32')).toBe(false);
    expect(shouldRetryProductionBuild({ exitCode: 2, success: false }, 1, 2, 'win32')).toBe(false);
    expect(
      shouldRetryProductionBuild(
        { exitCode: 3, success: false, signalCode: 'SIGSEGV' },
        1,
        2,
        'win32'
      )
    ).toBe(false);
  });
});
