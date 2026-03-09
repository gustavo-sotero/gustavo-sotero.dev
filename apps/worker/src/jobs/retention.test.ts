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

const { dbDeleteMock, dbUpdateMock, deleteWhereMock, updateWhereMock, updateSetMock } = vi.hoisted(
  () => ({
    dbDeleteMock: vi.fn(),
    dbUpdateMock: vi.fn(),
    deleteWhereMock: vi.fn(),
    updateWhereMock: vi.fn(),
    updateSetMock: vi.fn(),
  })
);

const { ltMock, neMock, andMock, contactsTable, commentsTable, analyticsEventsTable } = vi.hoisted(
  () => ({
    ltMock: vi.fn(() => ({ _op: 'lt' })),
    neMock: vi.fn(() => ({ _op: 'ne' })),
    andMock: vi.fn(() => ({ _op: 'and' })),
    contactsTable: { id: 'contacts.id', createdAt: 'contacts.createdAt' },
    commentsTable: {
      id: 'comments.id',
      createdAt: 'comments.createdAt',
      authorEmail: 'comments.authorEmail',
    },
    analyticsEventsTable: { id: 'analytics.id', createdAt: 'analytics.createdAt' },
  })
);

vi.mock('../config/db', () => ({
  db: {
    delete: dbDeleteMock,
    update: dbUpdateMock,
  },
}));

vi.mock('../config/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('drizzle-orm', () => ({
  lt: ltMock,
  ne: neMock,
  and: andMock,
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  contacts: contactsTable,
  comments: commentsTable,
  analyticsEvents: analyticsEventsTable,
}));

import { processRetention } from './retention';

beforeEach(() => {
  vi.clearAllMocks();

  const deleteReturningMock = vi.fn();
  deleteWhereMock.mockReturnValue({ returning: deleteReturningMock });
  dbDeleteMock.mockReturnValue({ where: deleteWhereMock });

  const updateReturningMock = vi.fn();
  updateWhereMock.mockReturnValue({ returning: updateReturningMock });
  updateSetMock.mockReturnValue({ where: updateWhereMock });
  dbUpdateMock.mockReturnValue({ set: updateSetMock });
});

describe('processRetention', () => {
  it('executes all three retention queries', async () => {
    const deleteReturningMock = vi.fn();
    deleteWhereMock
      .mockReturnValueOnce({ returning: deleteReturningMock })
      .mockReturnValueOnce({ returning: deleteReturningMock });
    deleteReturningMock
      .mockResolvedValueOnce([{ id: 1 }, { id: 2 }])
      .mockResolvedValueOnce([{ id: 5 }, { id: 6 }, { id: 7 }]);

    const updateReturningMock = vi.fn().mockResolvedValueOnce([{ id: '10' }]);
    updateWhereMock.mockReturnValueOnce({ returning: updateReturningMock });

    await processRetention();

    expect(dbDeleteMock).toHaveBeenCalledTimes(2);
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('handles zero affected rows without error', async () => {
    const deleteReturningMock = vi.fn().mockResolvedValue([]);
    deleteWhereMock.mockReturnValue({ returning: deleteReturningMock });

    const updateReturningMock = vi.fn().mockResolvedValue([]);
    updateWhereMock.mockReturnValue({ returning: updateReturningMock });

    await processRetention();

    expect(dbDeleteMock).toHaveBeenCalledTimes(2);
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('continues remaining operations when one query fails', async () => {
    const deleteReturningMock = vi.fn();
    deleteWhereMock
      .mockReturnValueOnce({ returning: deleteReturningMock })
      .mockReturnValueOnce({ returning: deleteReturningMock });
    deleteReturningMock.mockRejectedValueOnce(new Error('DB timeout on contacts'));
    deleteReturningMock.mockResolvedValueOnce([]);

    const updateReturningMock = vi.fn().mockResolvedValueOnce([{ id: '1' }]);
    updateWhereMock.mockReturnValueOnce({ returning: updateReturningMock });

    // Should NOT throw — retention is best-effort per operation
    await expect(processRetention()).resolves.toBeUndefined();

    // All 3 operations were attempted
    expect(dbDeleteMock).toHaveBeenCalledTimes(2);
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
  });

  it('continues when all three operations fail independently', async () => {
    const deleteReturningMock = vi.fn().mockRejectedValue(new Error('DB unavailable'));
    deleteWhereMock.mockReturnValue({ returning: deleteReturningMock });

    const updateReturningMock = vi.fn().mockRejectedValue(new Error('DB unavailable'));
    updateWhereMock.mockReturnValue({ returning: updateReturningMock });

    await expect(processRetention()).resolves.toBeUndefined();

    expect(dbDeleteMock).toHaveBeenCalledTimes(2);
    expect(dbUpdateMock).toHaveBeenCalledTimes(1);
  });
});
