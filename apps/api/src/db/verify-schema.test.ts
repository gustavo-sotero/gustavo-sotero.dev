import { beforeEach, describe, expect, it, vi } from 'vitest';

const { executeMock } = vi.hoisted(() => ({
  executeMock: vi.fn(),
}));

vi.mock('../config/db', () => ({
  db: {
    execute: executeMock,
  },
}));

import { verifyRequiredSchema } from './verify-schema';

describe('verifyRequiredSchema', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns ok when all required schema objects exist', async () => {
    // 3 table checks
    executeMock
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }]);

    await expect(verifyRequiredSchema()).resolves.toEqual({ ok: true, missing: [] });
    expect(executeMock).toHaveBeenCalledTimes(3);
  });

  it('lists every missing object when schema parity is broken', async () => {
    // 3 table checks — all missing
    executeMock
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }]);

    await expect(verifyRequiredSchema()).resolves.toEqual({
      ok: false,
      missing: ['table:skills', 'table:project_skills', 'table:experience_skills'],
    });
  });
});
