import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { dbMock } = vi.hoisted(() => {
  // Chainable query builder mock that returns a configurable final result.
  const queryChain = {
    select: vi.fn(),
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
    insert: vi.fn(),
    values: vi.fn(),
    onConflictDoUpdate: vi.fn(),
    returning: vi.fn(),
  };

  // Make each method return the chain itself so calls can be chained fluently.
  for (const key of Object.keys(queryChain) as (keyof typeof queryChain)[]) {
    queryChain[key].mockReturnValue(queryChain);
  }

  return { dbMock: queryChain };
});

vi.mock('../config/db', () => ({ db: dbMock }));

// We only need the table reference for import; Drizzle operators are not called.
vi.mock('@portfolio/shared/db/schema', () => ({
  aiPostGenerationSettings: { scope: 'scope', topicsModelId: 'topicsModelId' },
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((_col: unknown, val: unknown) => ({ _eq: val })),
}));

import {
  findAiPostGenerationSettings,
  upsertAiPostGenerationSettings,
} from './ai-post-generation-settings.repo';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const SAVED_ROW = {
  scope: 'global',
  topicsModelId: 'openai/gpt-4o',
  draftModelId: 'anthropic/claude-3-haiku',
  updatedBy: 'admin-123',
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-02'),
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('ai-post-generation-settings.repo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset entire chain to return itself by default.
    for (const key of Object.keys(dbMock) as (keyof typeof dbMock)[]) {
      dbMock[key].mockReturnValue(dbMock);
    }
  });

  describe('findAiPostGenerationSettings', () => {
    it('returns the existing row when one is found', async () => {
      dbMock.limit.mockResolvedValueOnce([SAVED_ROW]);

      const result = await findAiPostGenerationSettings();

      expect(result).toEqual(SAVED_ROW);
    });

    it('returns null when no row exists', async () => {
      dbMock.limit.mockResolvedValueOnce([]);

      const result = await findAiPostGenerationSettings();

      expect(result).toBeNull();
    });

    it('queries the table with scope = global', async () => {
      dbMock.limit.mockResolvedValueOnce([SAVED_ROW]);

      await findAiPostGenerationSettings();

      // where() should have been called (eq wraps the scope column).
      expect(dbMock.where).toHaveBeenCalled();
      expect(dbMock.limit).toHaveBeenCalledWith(1);
    });
  });

  describe('upsertAiPostGenerationSettings', () => {
    it('returns the persisted row after upsert', async () => {
      dbMock.returning.mockResolvedValueOnce([SAVED_ROW]);

      const result = await upsertAiPostGenerationSettings({
        topicsModelId: 'openai/gpt-4o',
        draftModelId: 'anthropic/claude-3-haiku',
        updatedBy: 'admin-123',
      });

      expect(result).toEqual(SAVED_ROW);
    });

    it('calls insert with the provided model IDs and updatedBy', async () => {
      dbMock.returning.mockResolvedValueOnce([SAVED_ROW]);

      await upsertAiPostGenerationSettings({
        topicsModelId: 'openai/gpt-4o',
        draftModelId: 'anthropic/claude-3-haiku',
        updatedBy: 'admin-456',
      });

      expect(dbMock.values).toHaveBeenCalledWith(
        expect.objectContaining({
          topicsModelId: 'openai/gpt-4o',
          draftModelId: 'anthropic/claude-3-haiku',
          updatedBy: 'admin-456',
          scope: 'global',
        })
      );
    });

    it('uses onConflictDoUpdate targeting the scope column', async () => {
      dbMock.returning.mockResolvedValueOnce([SAVED_ROW]);

      await upsertAiPostGenerationSettings({
        topicsModelId: 'openai/gpt-4o',
        draftModelId: 'anthropic/claude-3-haiku',
        updatedBy: 'admin-123',
      });

      expect(dbMock.onConflictDoUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          target: expect.anything(), // scope column reference
          set: expect.objectContaining({
            topicsModelId: 'openai/gpt-4o',
            draftModelId: 'anthropic/claude-3-haiku',
            updatedBy: 'admin-123',
          }),
        })
      );
    });

    it('throws when the DB returns no row', async () => {
      dbMock.returning.mockResolvedValueOnce([]);

      await expect(
        upsertAiPostGenerationSettings({
          topicsModelId: 'openai/gpt-4o',
          draftModelId: 'anthropic/claude-3-haiku',
          updatedBy: 'admin-123',
        })
      ).rejects.toThrow('Upsert returned no row');
    });
  });
});
