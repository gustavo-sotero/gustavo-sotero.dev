import { OutboxEventType } from '@portfolio/shared/constants/enums';
import { imageOptimizeJobId } from '@portfolio/shared/lib/jobIds';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  dbSelectMock,
  dbUpdateSetMock,
  dbUpdateWhereMock,
  imageQueueAddMock,
  loggerInfoMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateSetMock: vi.fn(),
  dbUpdateWhereMock: vi.fn(),
  imageQueueAddMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerErrorMock: vi.fn(),
}));

vi.mock('../config/db', () => ({
  db: {
    select: dbSelectMock,
    update: vi.fn(() => ({ set: dbUpdateSetMock })),
  },
}));

vi.mock('../config/logger', () => ({
  getLogger: () => ({
    info: loggerInfoMock,
    debug: vi.fn(),
    warn: vi.fn(),
    error: loggerErrorMock,
  }),
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  outbox: {
    id: Symbol('outbox.id'),
    status: Symbol('outbox.status'),
    attempts: Symbol('outbox.attempts'),
    createdAt: Symbol('outbox.createdAt'),
  },
  uploads: {
    id: Symbol('uploads.id'),
    status: Symbol('uploads.status'),
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...conditions: unknown[]) => ({ conditions, op: 'and' })),
  asc: vi.fn((field: unknown) => ({ field, op: 'asc' })),
  count: vi.fn(() => ({ op: 'count' })),
  eq: vi.fn((field: unknown, value: unknown) => ({ field, value, op: 'eq' })),
  lte: vi.fn((field: unknown, value: unknown) => ({ field, value, op: 'lte' })),
  min: vi.fn((field: unknown) => ({ field, op: 'min' })),
}));

import { processOutboxEvents, resetOutboxRelayStateForTests } from './outbox-relay';

function makeBacklogMetricsQuery(backlog: number, oldest: Date | null) {
  return {
    from: vi.fn(() => ({
      where: vi.fn().mockResolvedValue([{ backlog, oldest }]),
    })),
  };
}

function makeEventsQuery(events: unknown[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        orderBy: vi.fn(() => ({
          limit: vi.fn().mockResolvedValue(events),
        })),
      })),
    })),
  };
}

function makeQueues() {
  return {
    imageQueue: { add: imageQueueAddMock },
    postPublishQueue: { add: vi.fn(), getJob: vi.fn() },
    aiPostDraftGenerationQueue: { add: vi.fn() },
    aiPostTopicGenerationQueue: { add: vi.fn() },
  } as const;
}

describe('processOutboxEvents observability metrics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOutboxRelayStateForTests();
    dbUpdateSetMock.mockReturnValue({ where: dbUpdateWhereMock });
    dbUpdateWhereMock.mockResolvedValue(undefined);
    imageQueueAddMock.mockResolvedValue(undefined);
  });

  it('logs backlog size, oldest pending age, batch size, duration, and processed counts', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(50_000);
    const event = {
      id: '00000000-0000-0000-0000-000000000123',
      eventType: OutboxEventType.IMAGE_OPTIMIZE,
      payload: { uploadId: '00000000-0000-0000-0000-000000000042' },
      attempts: 0,
      status: 'pending',
      createdAt: new Date(45_000),
      processedAt: null,
      lastAttemptAt: null,
      errorMessage: null,
    };

    dbSelectMock
      .mockReturnValueOnce(makeBacklogMetricsQuery(7, new Date(30_000)))
      .mockReturnValueOnce(makeEventsQuery([event]));

    const { imageQueue, postPublishQueue, aiPostDraftGenerationQueue, aiPostTopicGenerationQueue } =
      makeQueues();

    await processOutboxEvents(
      imageQueue as never,
      postPublishQueue as never,
      aiPostDraftGenerationQueue as never,
      aiPostTopicGenerationQueue as never
    );

    expect(imageQueueAddMock).toHaveBeenCalledWith(
      OutboxEventType.IMAGE_OPTIMIZE,
      { uploadId: '00000000-0000-0000-0000-000000000042' },
      expect.objectContaining({ jobId: imageOptimizeJobId(event.id) })
    );
    expect(loggerErrorMock).not.toHaveBeenCalled();
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Outbox relay: cycle complete',
      expect.objectContaining({
        backlogSize: 7,
        oldestPendingAgeMs: 20_000,
        batchSize: 1,
        cycleDurationMs: 0,
        processedCount: 1,
        failedCount: 0,
        processedByEventType: {
          [OutboxEventType.IMAGE_OPTIMIZE]: 1,
        },
      })
    );
  });
});
