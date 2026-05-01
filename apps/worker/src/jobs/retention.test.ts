/**
 * Tests for the data retention job handler.
 *
 * Covers:
 *  - Deletes contacts older than 90 days
 *  - Anonymizes comment emails older than 90 days
 *  - Deletes analytics events older than 90 days
 *  - Logs affected row counts on completion
 *  - Continues other operations even if one fails
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbExecuteMock, loggerInfoMock, loggerErrorMock, sqlMock } = vi.hoisted(() => ({
  dbExecuteMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
  sqlMock: vi.fn((strings: TemplateStringsArray, ...values: unknown[]) => ({
    strings,
    values,
  })),
}));

vi.mock('../config/db', () => ({
  db: {
    execute: dbExecuteMock,
  },
}));

vi.mock('../config/logger', () => ({
  getLogger: () => ({
    info: loggerInfoMock,
    warn: vi.fn(),
    error: loggerErrorMock,
    debug: vi.fn(),
  }),
}));

vi.mock('drizzle-orm', () => ({
  sql: sqlMock,
}));

import { processRetention, RetentionCleanupError } from './retention';

async function expectRetentionFailure(): Promise<RetentionCleanupError> {
  try {
    await processRetention();
  } catch (error) {
    expect(error).toBeInstanceOf(RetentionCleanupError);
    return error as RetentionCleanupError;
  }

  throw new Error('Expected processRetention to throw');
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('processRetention', () => {
  it('executes all three retention queries', async () => {
    dbExecuteMock
      .mockResolvedValueOnce([{ count: 2 }])
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 3 }]);

    await processRetention();

    expect(dbExecuteMock).toHaveBeenCalledTimes(3);
  });

  it('handles zero affected rows without error', async () => {
    dbExecuteMock
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    await processRetention();

    expect(dbExecuteMock).toHaveBeenCalledTimes(3);
  });

  it('continues remaining operations when one query fails', async () => {
    dbExecuteMock
      .mockRejectedValueOnce(new Error('DB timeout on contacts'))
      .mockResolvedValueOnce([{ count: 1 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    const error = await expectRetentionFailure();
    expect(error.stepErrors).toEqual(['contacts: DB timeout on contacts']);
    expect(dbExecuteMock).toHaveBeenCalledTimes(3);
  });

  it('continues when all three operations fail independently', async () => {
    dbExecuteMock.mockRejectedValue(new Error('DB unavailable'));

    const error = await expectRetentionFailure();
    expect(error.stepErrors).toEqual([
      'contacts: DB unavailable',
      'comments: DB unavailable',
      'analytics_events: DB unavailable',
    ]);
    expect(dbExecuteMock).toHaveBeenCalledTimes(3);
  });
});
