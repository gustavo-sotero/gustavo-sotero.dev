import { OutboxEventType } from '@portfolio/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ───────────────────────────────────────────────────────────────────

const {
  dbSelectMock,
  dbUpdateSetMock,
  dbUpdateSetWhereMock,
  imageQueueAddMock,
  postPublishQueueAddMock,
  loggerInfoMock,
  loggerWarnMock,
  loggerErrorMock,
} = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateSetMock: vi.fn(),
  dbUpdateSetWhereMock: vi.fn(),
  imageQueueAddMock: vi.fn(),
  postPublishQueueAddMock: vi.fn(),
  loggerInfoMock: vi.fn(),
  loggerWarnMock: vi.fn(),
  loggerErrorMock: vi.fn(),
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
    info: loggerInfoMock,
    debug: vi.fn(),
    warn: loggerWarnMock,
    error: loggerErrorMock,
  }),
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  outbox: {
    id: Symbol('id'),
    status: Symbol('status'),
    attempts: Symbol('attempts'),
    createdAt: Symbol('createdAt'),
  },
  uploads: {
    id: Symbol('uploads.id'),
    status: Symbol('uploads.status'),
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
    payload: { uploadId: '00000000-0000-0000-0000-000000000001' },
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

import {
  OUTBOX_MAX_ATTEMPTS,
  processOutboxEvents,
  resetOutboxRelayStateForTests,
} from './outbox-relay';

describe('processOutboxEvents', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOutboxRelayStateForTests();

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
      payload: { uploadId: '00000000-0000-0000-0000-000000000042' },
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
      { uploadId: '00000000-0000-0000-0000-000000000042' },
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

  it('warns once and suppresses repeated logs while outbox schema is unavailable', async () => {
    const missingOutboxError = Object.assign(new Error('relation "outbox" does not exist'), {
      code: '42P01',
    });

    dbSelectMock.mockReturnValue({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn().mockRejectedValue(missingOutboxError),
          })),
        })),
      })),
    });

    const { imageQueue, postPublishQueue } = makeQueues();

    await processOutboxEvents(imageQueue, postPublishQueue);
    await processOutboxEvents(imageQueue, postPublishQueue);

    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Outbox relay: outbox schema unavailable; waiting for migrations to complete',
      expect.objectContaining({ error: 'relation "outbox" does not exist' })
    );
    expect(loggerErrorMock).not.toHaveBeenCalled();
  });

  it('logs relay recovery once the outbox schema becomes available again', async () => {
    const missingOutboxError = Object.assign(new Error('relation "outbox" does not exist'), {
      code: '42P01',
    });

    dbSelectMock
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockRejectedValue(missingOutboxError),
            })),
          })),
        })),
      })
      .mockReturnValueOnce({
        from: vi.fn(() => ({
          where: vi.fn(() => ({
            orderBy: vi.fn(() => ({
              limit: vi.fn().mockResolvedValue([]),
            })),
          })),
        })),
      });

    const { imageQueue, postPublishQueue } = makeQueues();

    await processOutboxEvents(imageQueue, postPublishQueue);
    await processOutboxEvents(imageQueue, postPublishQueue);

    expect(loggerWarnMock).toHaveBeenCalledTimes(1);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Outbox relay: outbox schema detected; resuming relay processing'
    );
  });

  it('does nothing when there are no pending events', async () => {
    // Default setup already returns empty list
    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    expect(imageQueueAddMock).not.toHaveBeenCalled();
    expect(postPublishQueueAddMock).not.toHaveBeenCalled();
    expect(dbUpdateSetMock).not.toHaveBeenCalled();
  });

  it('classifies image-optimize with missing uploadId as INVALID_PAYLOAD', async () => {
    const event = makeEvent({
      eventType: OutboxEventType.IMAGE_OPTIMIZE,
      payload: { wrong_field: 'no-upload-id' },
      attempts: 0,
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

    // Queue must NOT have been invoked — payload validation blocked the publish
    expect(imageQueueAddMock).not.toHaveBeenCalled();
    // Attempt should be incremented
    expect(dbUpdateSetMock).toHaveBeenCalledWith(expect.objectContaining({ attempts: 1 }));
    // Failure class must be logged as INVALID_PAYLOAD
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Outbox relay: failed to process event',
      expect.objectContaining({ failureClass: 'INVALID_PAYLOAD' })
    );
  });

  it('classifies scheduled-post-publish with missing postId as INVALID_PAYLOAD', async () => {
    const event = makeEvent({
      eventType: OutboxEventType.SCHEDULED_POST_PUBLISH,
      payload: { scheduledAt: new Date(Date.now() + 5000).toISOString() }, // postId missing
      attempts: 0,
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

    expect(postPublishQueueAddMock).not.toHaveBeenCalled();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Outbox relay: failed to process event',
      expect.objectContaining({ failureClass: 'INVALID_PAYLOAD' })
    );
  });

  it('classifies imageQueue.add() failure as QUEUE_PUBLISH_FAILURE', async () => {
    const event = makeEvent({
      eventType: OutboxEventType.IMAGE_OPTIMIZE,
      payload: { uploadId: '123e4567-e89b-12d3-a456-426614174000' },
      attempts: 0,
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
    imageQueueAddMock.mockRejectedValue(new Error('Redis connection refused'));

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Outbox relay: failed to process event',
      expect.objectContaining({ failureClass: 'QUEUE_PUBLISH_FAILURE' })
    );
    // Must NOT mark event as processed
    expect(dbUpdateSetMock).not.toHaveBeenCalledWith(
      expect.objectContaining({ status: 'processed' })
    );
  });

  it('classifies postPublishQueue.add() failure as QUEUE_PUBLISH_FAILURE', async () => {
    const futureTime = new Date(Date.now() + 10_000).toISOString();
    const event = makeEvent({
      eventType: OutboxEventType.SCHEDULED_POST_PUBLISH,
      payload: { postId: 42, scheduledAt: futureTime },
      attempts: 0,
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
    postPublishQueueAddMock.mockRejectedValue(new Error('BullMQ unavailable'));

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Outbox relay: failed to process event',
      expect.objectContaining({ failureClass: 'QUEUE_PUBLISH_FAILURE' })
    );
  });

  it('classifies outbox-status-update failure after successful publish as OUTBOX_STATUS_UPDATE_FAILURE', async () => {
    const event = makeEvent({
      eventType: OutboxEventType.IMAGE_OPTIMIZE,
      payload: { uploadId: '123e4567-e89b-12d3-a456-426614174000' },
      attempts: 0,
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

    // First db.update call (mark outbox processed) rejects
    // Second db.update call (attempt increment) should succeed — use where mock
    dbUpdateSetWhereMock
      .mockRejectedValueOnce(new Error('DB write timeout')) // outbox processed update
      .mockResolvedValue(undefined); // attempt increment update

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    // Queue publish DID happen
    expect(imageQueueAddMock).toHaveBeenCalledOnce();
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Outbox relay: failed to process event',
      expect.objectContaining({ failureClass: 'OUTBOX_STATUS_UPDATE_FAILURE' })
    );
  });

  it('reconciles upload to failed when image-optimize relay reaches terminal failure', async () => {
    const uploadId = '123e4567-e89b-12d3-a456-426614174000';
    const event = makeEvent({
      eventType: OutboxEventType.IMAGE_OPTIMIZE,
      payload: { uploadId },
      attempts: OUTBOX_MAX_ATTEMPTS - 1, // next attempt is the final one
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
    imageQueueAddMock.mockRejectedValue(new Error('Queue unreachable'));

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    // Outbox row must be marked as finally failed
    expect(dbUpdateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', attempts: OUTBOX_MAX_ATTEMPTS })
    );

    // Upload reconciliation: set({ status: 'failed' }) with only that field
    // (contrasting with the outbox update which carries attempts, lastAttemptAt, etc.)
    const allSetCalls = dbUpdateSetMock.mock.calls as [Record<string, unknown>][];
    const uploadReconcileCall = allSetCalls.find(
      ([args]) => Object.keys(args).length === 1 && args.status === 'failed'
    );
    expect(uploadReconcileCall).toBeDefined();

    // Warning log confirming reconciliation
    expect(loggerWarnMock).toHaveBeenCalledWith(
      'Outbox relay: upload marked as failed after terminal relay failure',
      expect.objectContaining({ eventId: event.id, uploadId })
    );
  });

  it('does NOT reconcile upload when outbox-status-update fails after successful publish', async () => {
    // If queue.add() succeeded but markng the outbox row processed fails,
    // the job is live in BullMQ — imageOptimize.ts will set the terminal state.
    // The relay must NOT overwrite the upload to 'failed' prematurely.
    const uploadId = '123e4567-e89b-12d3-a456-426614174000';
    const event = makeEvent({
      eventType: OutboxEventType.IMAGE_OPTIMIZE,
      payload: { uploadId },
      attempts: OUTBOX_MAX_ATTEMPTS - 1,
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

    // The outbox processed-status write fails
    dbUpdateSetWhereMock
      .mockRejectedValueOnce(new Error('DB write timeout'))
      .mockResolvedValue(undefined);

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    // failureClass must be OUTBOX_STATUS_UPDATE_FAILURE, not QUEUE_PUBLISH_FAILURE
    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Outbox relay: failed to process event',
      expect.objectContaining({ failureClass: 'OUTBOX_STATUS_UPDATE_FAILURE' })
    );

    // Upload reconciliation must NOT have been triggered
    expect(loggerWarnMock).not.toHaveBeenCalledWith(
      'Outbox relay: upload marked as failed after terminal relay failure',
      expect.anything()
    );
    const allSetCalls = dbUpdateSetMock.mock.calls as [Record<string, unknown>][];
    const uploadReconcileCall = allSetCalls.find(
      ([args]) => Object.keys(args).length === 1 && args.status === 'failed'
    );
    expect(uploadReconcileCall).toBeUndefined();
  });

  it('does not attempt upload reconciliation for non-image-optimize event types', async () => {
    const event = makeEvent({
      eventType: 'unknown-event',
      payload: {},
      attempts: OUTBOX_MAX_ATTEMPTS - 1,
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

    expect(loggerWarnMock).not.toHaveBeenCalledWith(
      'Outbox relay: upload marked as failed after terminal relay failure',
      expect.anything()
    );
  });

  it('logs uploadId in error log when derivable from image-optimize payload', async () => {
    const uploadId = '123e4567-e89b-12d3-a456-426614174000';
    const event = makeEvent({
      eventType: OutboxEventType.IMAGE_OPTIMIZE,
      payload: { uploadId },
      attempts: 0,
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
    imageQueueAddMock.mockRejectedValue(new Error('Queue error'));

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    expect(loggerErrorMock).toHaveBeenCalledWith(
      'Outbox relay: failed to process event',
      expect.objectContaining({ uploadId })
    );
  });
});
