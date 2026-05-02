import type { Queue } from 'bullmq';
import { describe, expect, it } from 'vitest';
import { collectManagedQueues, collectObservedQueues, defineWorkerSpec } from './worker-registry';

function makeQueue(name: string): Queue {
  return {
    name,
  } as Queue;
}

describe('worker registry helpers', () => {
  it('derives observed queues from worker specs and DLQ metadata', () => {
    const primaryQueue = makeQueue('primary');
    const dlqQueue = makeQueue('primary-dlq');
    const hiddenQueue = makeQueue('hidden');

    const specs = [
      defineWorkerSpec({
        queueName: 'primary',
        queue: primaryQueue,
        processor: async () => {},
        concurrency: 1,
        logLabel: 'Primary',
        observed: true,
        dlq: {
          queue: dlqQueue,
          jobName: 'primary-dlq-job',
          observedKey: 'primary-dlq',
        },
      }),
      defineWorkerSpec({
        queueName: 'hidden',
        queue: hiddenQueue,
        processor: async () => {},
        concurrency: 1,
        logLabel: 'Hidden',
      }),
    ] as const;

    expect(collectObservedQueues(specs)).toEqual([
      { key: 'primary', queue: primaryQueue },
      { key: 'primary-dlq', queue: dlqQueue },
    ]);
  });

  it('collects unique managed queues for shutdown', () => {
    const primaryQueue = makeQueue('primary');
    const dlqQueue = makeQueue('primary-dlq');

    const specs = [
      defineWorkerSpec({
        queueName: 'primary',
        queue: primaryQueue,
        processor: async () => {},
        concurrency: 1,
        logLabel: 'Primary',
        observed: true,
        dlq: {
          queue: dlqQueue,
          jobName: 'primary-dlq-job',
        },
      }),
      defineWorkerSpec({
        queueName: 'primary-again',
        queue: primaryQueue,
        processor: async () => {},
        concurrency: 1,
        logLabel: 'Primary again',
      }),
    ] as const;

    expect(collectManagedQueues(specs)).toEqual([primaryQueue, dlqQueue]);
  });
});
