import { describe, expect, it, vi } from 'vitest';
import { logQueueSnapshots, type ObservedQueue } from './queue-observability';

function makeQueue(overrides?: {
  counts?: Partial<Record<'waiting' | 'delayed' | 'active' | 'failed', number>>;
  waitingTimestamp?: number;
  delayedTimestamp?: number;
  getJobCountsError?: Error;
}) {
  return {
    getJobCounts: overrides?.getJobCountsError
      ? vi.fn().mockRejectedValue(overrides.getJobCountsError)
      : vi.fn().mockResolvedValue({
          waiting: overrides?.counts?.waiting ?? 0,
          delayed: overrides?.counts?.delayed ?? 0,
          active: overrides?.counts?.active ?? 0,
          failed: overrides?.counts?.failed ?? 0,
        }),
    getWaiting: vi
      .fn()
      .mockResolvedValue(
        overrides?.waitingTimestamp !== undefined ? [{ timestamp: overrides.waitingTimestamp }] : []
      ),
    getDelayed: vi
      .fn()
      .mockResolvedValue(
        overrides?.delayedTimestamp !== undefined ? [{ timestamp: overrides.delayedTimestamp }] : []
      ),
  };
}

describe('logQueueSnapshots', () => {
  it('logs queue counts and oldest waiting/delayed age for active queues', async () => {
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };
    const nowMs = 50_000;
    const observedQueues = [
      {
        key: 'image-optimize',
        queue: makeQueue({
          counts: { waiting: 2, delayed: 1, active: 1, failed: 0 },
          waitingTimestamp: 40_000,
          delayedTimestamp: 10_000,
        }),
      },
      {
        key: 'analytics-events',
        queue: makeQueue(),
      },
    ] as unknown as ObservedQueue[];

    await logQueueSnapshots(observedQueues, logger, nowMs);

    expect(logger.error).not.toHaveBeenCalled();
    expect(logger.info).toHaveBeenCalledWith('BullMQ queue snapshot', {
      queues: [
        {
          key: 'image-optimize',
          waiting: 2,
          delayed: 1,
          active: 1,
          failed: 0,
          oldestWaitingAgeMs: 10_000,
          oldestDelayedAgeMs: 40_000,
        },
      ],
    });
  });

  it('logs per-queue errors without aborting the whole snapshot cycle', async () => {
    const logger = {
      info: vi.fn(),
      error: vi.fn(),
    };
    const observedQueues = [
      {
        key: 'broken-queue',
        queue: makeQueue({ getJobCountsError: new Error('redis unavailable') }),
      },
      {
        key: 'post-publish',
        queue: makeQueue({ counts: { failed: 1 } }),
      },
    ] as unknown as ObservedQueue[];

    await logQueueSnapshots(observedQueues, logger, 25_000);

    expect(logger.error).toHaveBeenCalledWith('BullMQ queue snapshot failed', {
      queue: 'broken-queue',
      error: 'redis unavailable',
    });
    expect(logger.info).toHaveBeenCalledWith('BullMQ queue snapshot', {
      queues: [
        {
          key: 'post-publish',
          waiting: 0,
          delayed: 0,
          active: 0,
          failed: 1,
        },
      ],
    });
  });
});
