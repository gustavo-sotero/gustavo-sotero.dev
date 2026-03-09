import { OutboxEventType } from '@portfolio/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────

const {
  dbSelectMock,
  dbUpdateSetMock,
  dbUpdateSetWhereMock,
  imageQueueAddMock,
  postPublishQueueAddMock,
} = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateSetMock: vi.fn(),
  dbUpdateSetWhereMock: vi.fn(),
  imageQueueAddMock: vi.fn(),
  postPublishQueueAddMock: vi.fn(),
}));

vi.mock('../config/db', () => ({
  db: {
    select: dbSelectMock,
    update: vi.fn(() => ({
      set: dbUpdateSetMock,
    })),
  },
}));

vi.mock('../config/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    debug: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  outbox: {
    id: Symbol('id'),
    status: Symbol('status'),
    attempts: Symbol('attempts'),
    createdAt: Symbol('createdAt'),
  },
}));

vi.mock('drizzle-orm', () => ({
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  asc: vi.fn((col: unknown) => ({ asc: col })),
  eq: vi.fn((col: unknown, val: unknown) => ({ eq: [col, val] })),
  lte: vi.fn((col: unknown, val: unknown) => ({ lte: [col, val] })),
}));

// ── Helpers ─────────────────────────────────────────────────────────────────

function makeEvent(
  overrides: Partial<{
    id: string;
    eventType: string;
    payload: unknown;
    attempts: number;
    status: string;
  }> = {}
) {
  return {
    id: 'event-uuid-1',
    eventType: OutboxEventType.IMAGE_OPTIMIZE,
    payload: { uploadId: 'upload-1' },
    attempts: 0,
    status: 'pending',
    createdAt: new Date(),
    processedAt: null,
    lastAttemptAt: null,
    errorMessage: null,
    ...overrides,
  };
}

function makeQueues() {
  const imageQueue = { add: imageQueueAddMock } as never;
  const postPublishQueue = { add: postPublishQueueAddMock } as never;
  return { imageQueue, postPublishQueue };
}

// ── Tests ────────────────────────────────────────────────────────────────────

import { OUTBOX_MAX_ATTEMPTS, processOutboxEvents } from './outbox-relay';

describe('processOutboxEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default: select returns empty list
    dbSelectMock.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([]),
          })),
        })),
      })),
    });

    // Default: update resolves successfully
    dbUpdateSetMock.mockReturnValue({
      where: dbUpdateSetWhereMock,
    });
    dbUpdateSetWhereMock.mockResolvedValue(undefined);
  });

  it('enqueues image-optimize job and marks event processed on success', async () => {
    const event = makeEvent({
      eventType: OutboxEventType.IMAGE_OPTIMIZE,
      payload: { uploadId: 'upload-42' },
    });

    dbSelectMock.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([event]),
          })),
        })),
      })),
    });
    imageQueueAddMock.mockResolvedValue(undefined);

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    expect(imageQueueAddMock).toHaveBeenCalledWith(
      OutboxEventType.IMAGE_OPTIMIZE,
      { uploadId: 'upload-42' },
      expect.objectContaining({ jobId: `outbox:${event.id}` })
    );
    // Marks event as processed
    expect(dbUpdateSetMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'processed' }));
  });

  it('enqueues scheduled-post-publish job and marks event processed', async () => {
    const futureTime = new Date(Date.now() + 10_000).toISOString();
    const event = makeEvent({
      eventType: OutboxEventType.SCHEDULED_POST_PUBLISH,
      payload: { postId: 7, scheduledAt: futureTime },
    });

    dbSelectMock.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([event]),
          })),
        })),
      })),
    });
    postPublishQueueAddMock.mockResolvedValue(undefined);

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    expect(postPublishQueueAddMock).toHaveBeenCalledWith(
      'publish',
      { postId: 7 },
      expect.objectContaining({ jobId: 'post-publish:7' })
    );
    expect(dbUpdateSetMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'processed' }));
  });

  it('increments attempts and does NOT mark processed for unknown event type', async () => {
    const event = makeEvent({ eventType: 'unknown-future-event', attempts: 0 });

    dbSelectMock.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([event]),
          })),
        })),
      })),
    });

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    // Should NOT have marked as processed
    expect(dbUpdateSetMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processed' })
    );
    // Should have incremented attempts (but not failed — attempt 1 of 5)
    expect(dbUpdateSetMock).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1 }));
    // isFinal = false → status: 'failed' must NOT be in the update
    const setCall = dbUpdateSetMock.mock.calls[0] as [Record<string, unknown>] | undefined;
    expect(setCall?.[0]).not.toHaveProperty('status', 'failed');
  });

  it('marks event as failed after OUTBOX_MAX_ATTEMPTS attempts', async () => {
    const event = makeEvent({
      eventType: 'unknown-event',
      attempts: OUTBOX_MAX_ATTEMPTS - 1, // one more attempt will be the final
    });

    dbSelectMock.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockResolvedValue([event]),
          })),
        })),
      })),
    });

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    // Must mark as failed on the final attempt
    expect(dbUpdateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', attempts: OUTBOX_MAX_ATTEMPTS })
    );
  });

  it('returns without throwing when DB query fails', async () => {
    dbSelectMock.mockReturnValueOnce({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockRejectedValue(new Error('db connection lost')),
          })),
        })),
      })),
    });

    const { imageQueue, postPublishQueue } = makeQueues();
    // Must not throw — relay logs and returns gracefully
    await expect(processOutboxEvents(imageQueue, postPublishQueue)).resolves.toBeUndefined();
    expect(imageQueueAddMock).not.toHaveBeenCalled();
  });

  it('does nothing when there are no pending events', async () => {
    // Default setup already returns empty list
    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    expect(imageQueueAddMock).not.toHaveBeenCalled();
    expect(postPublishQueueAddMock).not.toHaveBeenCalled();
    expect(dbUpdateSetMock).not.toHaveBeenCalled();
  });
});
