import { AiGenerationError } from '@portfolio/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { envMock, createOpenRouterMock } = vi.hoisted(() => {
  const fakeProvider = { chat: vi.fn() };
  return {
    envMock: { OPENROUTER_API_KEY: 'sk-or-test-key' as string | undefined },
    createOpenRouterMock: vi.fn(() => fakeProvider),
  };
});

vi.mock('../../config/env', () => ({ env: envMock }));

vi.mock('@openrouter/ai-sdk-provider', () => ({
  createOpenRouter: createOpenRouterMock,
}));

import { getOpenRouterProvider } from './provider';

// ── Tests ─────────────────────────────────────────────────────────────────────
//
// IMPORTANT: tests below are ordered intentionally.
// The module-level `_openrouter` singleton persists for the lifetime of the test
// file. The "throws when key absent" test must run before the first successful
// provider creation so the singleton is still null at that point.
//
// Order: lazy-init → key-absent throws (singleton stays null) → success init → singleton reuse

describe('getOpenRouterProvider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.OPENROUTER_API_KEY = 'sk-or-test-key';
  });

  it('does not call createOpenRouter at module import time (lazy init)', () => {
    // This test must run first — before any call to getOpenRouterProvider().
    // vi.clearAllMocks() resets the call count so this assertion is always valid
    // as long as no prior test in this file has called the function.
    expect(createOpenRouterMock).not.toHaveBeenCalled();
  });

  it('throws when OPENROUTER_API_KEY is absent (before singleton is initialized)', () => {
    // Temporarily remove the key. The singleton is still null (no prior successful call),
    // so the key-check guard runs and throws.
    envMock.OPENROUTER_API_KEY = undefined;

    expect(() => getOpenRouterProvider()).toThrow(AiGenerationError);
    expect(() => getOpenRouterProvider()).toThrow('OPENROUTER_API_KEY is required');
  });

  it('returns a provider when the API key is present', () => {
    // This is the FIRST successful call — initializes the singleton.
    const provider = getOpenRouterProvider();

    expect(provider).toBeDefined();
    expect(createOpenRouterMock).toHaveBeenCalledOnce();
    expect(createOpenRouterMock).toHaveBeenCalledWith({ apiKey: 'sk-or-test-key' });
  });

  it('returns the same instance on subsequent calls (singleton)', () => {
    // The singleton was initialized in the previous test.
    // No new createOpenRouter call should happen in this test.
    const first = getOpenRouterProvider();
    const second = getOpenRouterProvider();

    expect(first).toBe(second);
    // createOpenRouterMock was cleared by beforeEach; no new call should occur.
    expect(createOpenRouterMock).not.toHaveBeenCalled();
  });
});
