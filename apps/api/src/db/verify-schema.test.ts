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
    // 4 table checks
    executeMock
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }]);

    await expect(verifyRequiredSchema()).resolves.toEqual({ ok: true, missing: [] });
    expect(executeMock).toHaveBeenCalledTimes(4);
  });

  it('lists every missing object when schema parity is broken', async () => {
    // 4 table checks — all missing
    executeMock
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }]);

    await expect(verifyRequiredSchema()).resolves.toEqual({
      ok: false,
      missing: [
        'table:experience_tags',
        'table:skills',
        'table:project_skills',
        'table:experience_skills',
      ],
    });
  });
});
