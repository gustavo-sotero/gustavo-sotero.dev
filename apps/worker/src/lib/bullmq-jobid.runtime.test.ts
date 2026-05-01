/**
 * BullMQ runtime validation — job ID contract regression guard.
 *
 * These tests exercise real BullMQ queue.add() calls against a live Redis
 * instance. They prove at the library level that:
 *
 *   a) BullMQ v5+ rejects custom jobId values containing `:` at runtime.
 *   b) Hyphen-separated IDs (as produced by the shared helpers) are accepted.
 *   c) Re-adding the same valid custom jobId is idempotent (deduplication).
 *
 * This catches exactly the class of bug that escaped our mock-based test suite:
 * `queue.add()` mocks cannot exercise BullMQ's internal jobId validation,
 * so only a real queue call can catch it.
 *
 * Availability: the tests skip gracefully when Redis is not reachable instead
 * of failing, so they do not break development workflows without a running
 * Redis instance. They will run (and must pass) in any environment that has
 * Redis available, including the docker-compose.test.yml test stack.
 */

import { imageOptimizeJobId, scheduledPostPublishJobId } from '@portfolio/shared/lib/jobIds';
import { parseRedisUrl } from '@portfolio/shared/lib/redis';
import { Queue, QueueEvents, Worker } from 'bullmq';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

// ── Helpers ───────────────────────────────────────────────────────────────────

const REDIS_URL = process.env.REDIS_URL ?? 'redis://localhost:6379';
const TEST_QUEUE_NAME = 'bullmq-jobid-runtime-test';

/**
 * Probe Redis connectivity by attempting a real PING after connection.
 * Uses the shared parseRedisUrl (which includes auth credentials from the URL)
 * so the probe reflects the same auth context as the actual queue operations.
 * Returns false if Redis is unreachable or authentication fails.
 */
async function isRedisAvailable(url: string): Promise<boolean> {
  const { default: IORedis } = await import('ioredis');

  const connOpts = parseRedisUrl(url);
  const client = new IORedis({
    ...connOpts,
    connectTimeout: 2000,
    maxRetriesPerRequest: 0,
    lazyConnect: true,
  });

  try {
    await client.connect();
    await client.ping();
    return true;
  } catch {
    return false;
  } finally {
    client.disconnect();
  }
}

// ── Fixture ───────────────────────────────────────────────────────────────────

let queue: Queue;
let redisAvailable = false;

beforeAll(async () => {
  redisAvailable = await isRedisAvailable(REDIS_URL);

  if (!redisAvailable) {
    return;
  }

  queue = new Queue(TEST_QUEUE_NAME, {
    connection: parseRedisUrl(REDIS_URL),
  });
});

beforeEach(async () => {
  if (!redisAvailable || !queue) return;

  try {
    await queue.obliterate({ force: true });
  } catch {
    // Queue may already be empty — safe to ignore
  }
});

afterAll(async () => {
  if (!redisAvailable || !queue) return;

  // Drain and close the test queue to avoid leaking connections
  try {
    await queue.obliterate({ force: true });
  } catch {
    // Queue may already be empty — safe to ignore
  }
  await queue.close();
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('BullMQ jobId runtime contract', () => {
  it('rejects a custom jobId containing a colon (:)', async () => {
    if (!redisAvailable) {
      console.warn('[skip] Redis unavailable — skipping BullMQ runtime test');
      return;
    }

    // This is the exact format that caused the production outbox relay failure:
    //   outbox-relay.ts used `outbox:${event.id}` — BullMQ v5 rejects it.
    await expect(
      queue.add('test-job', { data: 'test' }, { jobId: 'outbox:invalid-colon-id' })
    ).rejects.toThrow(/custom id cannot contain/i);
  });

  it('accepts an imageOptimizeJobId (hyphen-separated) without throwing', async () => {
    if (!redisAvailable) {
      return;
    }

    // imageOptimizeJobId returns `outbox-{uuid}` — no colon, accepted by BullMQ.
    const jobId = imageOptimizeJobId('aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee');
    await expect(
      queue.add('test-job', { uploadId: 'test-upload' }, { jobId })
    ).resolves.toMatchObject({
      id: jobId,
      name: 'test-job',
    });
  });

  it('accepts a scheduledPostPublishJobId (hyphen-separated) without throwing', async () => {
    if (!redisAvailable) {
      return;
    }

    // scheduledPostPublishJobId returns `post-publish-{postId}` — no colon.
    const jobId = scheduledPostPublishJobId(42);
    await expect(queue.add('test-job', { postId: 42 }, { jobId })).resolves.toMatchObject({
      id: jobId,
      name: 'test-job',
    });
  });

  it('deduplicates: re-adding the same valid custom jobId is a no-op', async () => {
    if (!redisAvailable) {
      return;
    }

    const jobId = imageOptimizeJobId('bbbbbbbb-cccc-dddd-eeee-ffffffffffff');

    const first = await queue.add(
      'test-job',
      { uploadId: 'dedup-test-1' },
      { jobId, delay: 60_000 }
    );
    const second = await queue.add(
      'test-job',
      { uploadId: 'dedup-test-2' },
      { jobId, delay: 60_000 }
    );
    const stored = await queue.getJob(jobId);
    const counts = await queue.getJobCounts('delayed');

    // Public API assertion: duplicate adds resolve to the same job ID, the stored
    // job keeps the first payload, and the queue only contains one delayed job.
    expect(first.id).toBe(jobId);
    expect(second.id).toBe(jobId);
    expect(stored?.data).toEqual({ uploadId: 'dedup-test-1' });
    expect(counts.delayed).toBe(1);
  });

  it('re-add com mesmo jobId NÃO atualiza o delay (documenta a raiz do bug de reagendamento)', async () => {
    if (!redisAvailable) {
      console.warn('[skip] Redis unavailable — skipping BullMQ runtime test');
      return;
    }

    // This test documents the exact BullMQ contract that caused the reschedule bug:
    // calling queue.add() with an existing custom jobId is silently deduped —
    // the delay from the first add() is preserved regardless of the second add().
    // The fix is to use job.changeDelay() for delayed jobs instead.
    const jobId = scheduledPostPublishJobId(999);
    const delayA = 120_000; // 2 min
    const delayB = 60_000; // 1 min — a user "rescheduled earlier"

    await queue.add('publish', { postId: 999 }, { jobId, delay: delayA });
    // Second add with same jobId and different delay — this is the relay behaviour
    // that was bugged: it adds again hoping BullMQ replaces, but it does not.
    await queue.add('publish', { postId: 999 }, { jobId, delay: delayB });

    const stored = await queue.getJob(jobId);
    const counts = await queue.getJobCounts('delayed');

    // Only one job should exist (deduplication worked)
    expect(counts.delayed).toBe(1);
    // The stored delay must still reflect delayA — the second add() was ignored.
    // This is the bug: the new scheduledAt is not respected by a naive re-add.
    expect(stored).toBeDefined();
    // BullMQ stores delay as milliseconds in job.opts.delay
    expect(stored?.opts.delay).toBe(delayA);
  });

  it('changeDelay() actualiza o delay de um job delayed existente (caminho correto de reagendamento)', async () => {
    if (!redisAvailable) {
      console.warn('[skip] Redis unavailable — skipping BullMQ runtime test');
      return;
    }

    // Validates that job.changeDelay() is the correct BullMQ-native API for
    // rescheduling a delayed job — this is the fix applied in outbox-relay.ts.
    // `opts.delay` is not a reliable assertion target after changeDelay(), so this
    // test validates observable queue behaviour: the job must complete within the
    // new shorter window instead of waiting for the original delay.
    const jobId = scheduledPostPublishJobId(1000);
    const delayA = 5_000; // original delay
    const delayB = 100; // rescheduled to sooner
    const connection = parseRedisUrl(REDIS_URL);
    const worker = new Worker(TEST_QUEUE_NAME, async () => 'processed', { connection });
    const queueEvents = new QueueEvents(TEST_QUEUE_NAME, { connection });

    try {
      await worker.waitUntilReady();
      await queueEvents.waitUntilReady();

      const startedAt = Date.now();
      const job = await queue.add('publish', { postId: 1000 }, { jobId, delay: delayA });

      // Simulate the relay calling changeDelay after receiving a new outbox event.
      await job.changeDelay(delayB);

      await expect(job.waitUntilFinished(queueEvents, 3_000)).resolves.toBe('processed');

      const elapsedMs = Date.now() - startedAt;
      expect(elapsedMs).toBeLessThan(delayA);
    } finally {
      await worker.close();
      await queueEvents.close();
    }
  });
});
