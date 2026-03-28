import { describe, expect, it } from 'vitest';

import {
  getInvalidNextRuntimeMessage,
  loadAndValidateNextRuntime,
  validateNextRuntimeModule,
} from './verify-next-runtime';

describe('verify-next-runtime', () => {
  it('accepts the expected Next internal runtime exports', () => {
    expect(() =>
      validateNextRuntimeModule({
        getRequestHandlers: () => undefined,
        startServer: () => Promise.resolve({ distDir: '.next' }),
      })
    ).not.toThrow();
  });

  it('throws an actionable error when the runtime module is truncated', () => {
    expect(() => validateNextRuntimeModule({})).toThrow(getInvalidNextRuntimeMessage());
  });

  it('supports injecting a loader for CLI usage', () => {
    expect(() =>
      loadAndValidateNextRuntime(() => ({
        getRequestHandlers: () => undefined,
        startServer: () => Promise.resolve({ distDir: '.next' }),
      }))
    ).not.toThrow();
  });
});
