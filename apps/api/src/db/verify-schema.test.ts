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
    // 3 required-table checks + 2 legacy-pivot absence checks
    executeMock
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }]);

    await expect(verifyRequiredSchema()).resolves.toEqual({
      ok: true,
      missing: [],
      unexpected: [],
    });
    expect(executeMock).toHaveBeenCalledTimes(5);
  });

  it('lists missing required tables and unexpected legacy pivots', async () => {
    // 3 required-table checks + 2 legacy-pivot absence checks
    executeMock
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: false }])
      .mockResolvedValueOnce([{ exists: true }])
      .mockResolvedValueOnce([{ exists: true }]);

    await expect(verifyRequiredSchema()).resolves.toEqual({
      ok: false,
      missing: ['table:skills', 'table:project_skills', 'table:experience_skills'],
      unexpected: ['table:project_tags', 'table:experience_tags'],
    });
  });
});
