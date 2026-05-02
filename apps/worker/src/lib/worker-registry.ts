/**
 * Typed worker factory.
 *
 * Encapsulates the repetitive Worker construction + event-handler boilerplate
 * so each worker spec only needs to declare its queue name, processor, and
 * concurrency. DLQ routing and structured logging are handled here uniformly.
 *
 * Behaviour guarantees:
 *  - DLQ workers: only log when the final attempt is exhausted (DLQ move).
 *    Intermediate failures are silent to avoid duplicate noise — BullMQ's own
 *    retry logic already records those.
 *  - Non-DLQ workers: log on every failure.
 *  - All workers: log on completion and on connection-level errors.
 */

import type { Logger } from '@logtape/logtape';
import { type ConnectionOptions, type Job, type Queue, Worker } from 'bullmq';
import type { ObservedQueue } from './queue-observability';

interface DlqSpec {
  /** BullMQ Queue instance for the dead-letter queue. */
  queue: Queue;
  /** Job name used when adding to the DLQ. */
  jobName: string;
  /** Optional observability key when the DLQ should be included in snapshots. */
  observedKey?: string;
  /**
   * Maximum attempts before moving to DLQ.
   * Defaults to `job.opts.attempts ?? 3`.
   */
  maxAttempts?: number;
}

export interface WorkerSpec<TData = unknown> {
  queueName: string;
  queue: Queue;
  processor: (job: Job<TData>, token?: string) => Promise<void>;
  concurrency: number;
  dlq?: DlqSpec;
  logLabel: string;
  observed?: boolean;
  /** Extra fields to log on job completion. */
  completedLogFields?: (job: Job<TData>) => Record<string, unknown>;
  /** Extra fields to log on job failure. */
  failedLogFields?: (job: Job<TData>) => Record<string, unknown>;
}

type WorkerTuple<TSpecs extends readonly unknown[]> = {
  [K in keyof TSpecs]: TSpecs[K] extends WorkerSpec<infer TData> ? Worker<TData> : never;
};

export function defineWorkerSpec<TData>(spec: WorkerSpec<TData>): WorkerSpec<TData> {
  return spec;
}

/**
 * Create a BullMQ Worker from a typed spec with uniform logging and DLQ routing.
 */
export function createWorker<TData = unknown>(
  spec: WorkerSpec<TData>,
  connection: ConnectionOptions,
  logger: Logger
): Worker<TData> {
  const worker = new Worker<TData>(spec.queueName, (job, token) => spec.processor(job, token), {
    connection,
    concurrency: spec.concurrency,
  });

  worker.on('completed', (job) => {
    logger.info(`${spec.logLabel} completed`, {
      jobId: job.id,
      ...spec.completedLogFields?.(job),
    });
  });

  worker.on('failed', async (job, err) => {
    if (!job) return;

    if (spec.dlq) {
      const maxAttempts = spec.dlq.maxAttempts ?? job.opts.attempts ?? 3;
      if (job.attemptsMade >= maxAttempts) {
        logger.error(`${spec.logLabel} moved to DLQ after all retries exhausted`, {
          jobId: job.id,
          error: err.message,
          ...spec.failedLogFields?.(job),
        });
        await spec.dlq.queue
          .add(spec.dlq.jobName, {
            originalJob: job.data,
            error: err.message,
            failedAt: new Date().toISOString(),
            jobId: job.id,
          })
          .catch((dlqErr) => {
            logger.error(`Failed to add ${spec.logLabel} job to DLQ`, {
              error: (dlqErr as Error).message,
            });
          });
      }
      return;
    }

    logger.error(`${spec.logLabel} failed`, {
      jobId: job.id,
      attempt: job.attemptsMade,
      error: err.message,
      ...spec.failedLogFields?.(job),
    });
  });

  worker.on('error', (err) => {
    logger.error(`${spec.logLabel} error`, { error: err.message });
  });

  return worker;
}

export function createWorkers<const TSpecs extends readonly unknown[]>(
  specs: TSpecs,
  connection: ConnectionOptions,
  logger: Logger
): WorkerTuple<TSpecs> {
  return specs.map((spec) =>
    createWorker(spec as WorkerSpec<unknown>, connection, logger)
  ) as WorkerTuple<TSpecs>;
}

export function collectObservedQueues(specs: readonly unknown[]): ObservedQueue[] {
  const observedQueues: ObservedQueue[] = [];

  for (const spec of specs) {
    const workerSpec = spec as WorkerSpec<unknown>;

    if (workerSpec.observed) {
      observedQueues.push({ key: workerSpec.queueName, queue: workerSpec.queue });
    }

    if (workerSpec.dlq?.observedKey) {
      observedQueues.push({ key: workerSpec.dlq.observedKey, queue: workerSpec.dlq.queue });
    }
  }

  return observedQueues;
}

export function collectManagedQueues(specs: readonly unknown[]): Queue[] {
  const queues = new Map<string, Queue>();

  for (const spec of specs) {
    const workerSpec = spec as WorkerSpec<unknown>;

    queues.set(workerSpec.queue.name, workerSpec.queue);

    if (workerSpec.dlq) {
      queues.set(workerSpec.dlq.queue.name, workerSpec.dlq.queue);
    }
  }

  return [...queues.values()];
}
