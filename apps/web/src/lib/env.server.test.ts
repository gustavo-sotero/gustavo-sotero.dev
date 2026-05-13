import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BUILD_ENV_DEFAULTS } from './build-env-defaults';

describe('server env validation', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = { ...process.env };
  });

  afterEach(() => {
    process.env = originalEnv;
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('throws when REVALIDATE_SECRET is missing outside the Next production build phase', async () => {
    delete process.env.REVALIDATE_SECRET;

    await expect(import('./env.server')).rejects.toThrow('Invalid server environment variables');
  });

  it('uses a smoke-build fallback secret during the Next production build phase', async () => {
    process.env.NEXT_PHASE = 'phase-production-build';
    delete process.env.REVALIDATE_SECRET;

    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { serverEnv } = await import('./env.server');

    expect(serverEnv.REVALIDATE_SECRET).toBe(BUILD_ENV_DEFAULTS.REVALIDATE_SECRET);
    expect(warnSpy).toHaveBeenCalledWith(
      '[build-env] Using smoke-build defaults for: REVALIDATE_SECRET'
    );
  });
});
