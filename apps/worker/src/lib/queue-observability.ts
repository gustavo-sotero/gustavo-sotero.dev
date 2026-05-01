import type { Queue } from 'bullmq';

export interface QueueObservabilityLogger {
  info(message: string, data: Record<string, unknown>): void;
  error(message: string, data: Record<string, unknown>): void;
}

export interface ObservedQueue {
  key: string;
  queue: Queue;
}

export interface QueueSnapshot {
  key: string;
  waiting: number;
  delayed: number;
  active: number;
  failed: number;
  oldestWaitingAgeMs?: number;
  oldestDelayedAgeMs?: number;
}

async function getOldestJobAgeMs(
  queue: Queue,
  state: 'waiting' | 'delayed',
  nowMs: number
): Promise<number | undefined> {
  const jobs = state === 'waiting' ? await queue.getWaiting(0, 0) : await queue.getDelayed(0, 0);
  const oldestJob = jobs[0];

  if (!oldestJob || typeof oldestJob.timestamp !== 'number') {
    return undefined;
  }

  return Math.max(0, nowMs - oldestJob.timestamp);
}

async function collectQueueSnapshot(
  observedQueue: ObservedQueue,
  nowMs: number
): Promise<QueueSnapshot> {
  const counts = await observedQueue.queue.getJobCounts('waiting', 'delayed', 'active', 'failed');
  const [oldestWaitingAgeMs, oldestDelayedAgeMs] = await Promise.all([
    getOldestJobAgeMs(observedQueue.queue, 'waiting', nowMs),
    getOldestJobAgeMs(observedQueue.queue, 'delayed', nowMs),
  ]);

  return {
    key: observedQueue.key,
    waiting: counts.waiting ?? 0,
    delayed: counts.delayed ?? 0,
    active: counts.active ?? 0,
    failed: counts.failed ?? 0,
    ...(oldestWaitingAgeMs !== undefined ? { oldestWaitingAgeMs } : {}),
    ...(oldestDelayedAgeMs !== undefined ? { oldestDelayedAgeMs } : {}),
  };
}

export async function logQueueSnapshots(
  observedQueues: ObservedQueue[],
  logger: QueueObservabilityLogger,
  nowMs = Date.now()
): Promise<void> {
  const snapshots: QueueSnapshot[] = [];

  for (const observedQueue of observedQueues) {
    try {
      snapshots.push(await collectQueueSnapshot(observedQueue, nowMs));
    } catch (error) {
      logger.error('BullMQ queue snapshot failed', {
        queue: observedQueue.key,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const activeSnapshots = snapshots.filter(
    (snapshot) =>
      snapshot.waiting > 0 || snapshot.delayed > 0 || snapshot.active > 0 || snapshot.failed > 0
  );

  if (activeSnapshots.length === 0) {
    return;
  }

  logger.info('BullMQ queue snapshot', {
    queues: activeSnapshots,
  });
}
