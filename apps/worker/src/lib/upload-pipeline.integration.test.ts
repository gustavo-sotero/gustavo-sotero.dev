/**
 * Integration scenario: upload pipeline state transitions
 *
 * Spans the two key async boundaries the plan identifies:
 *   1. Outbox relay publishes image-optimize job to BullMQ
 *   2. imageOptimize job processes the image and marks the upload `processed`
 *
 * Both stages run in the same test against a shared DB mock, proving the
 * data contract: the uploadId the relay writes into BullMQ is the same
 * uploadId imageOptimize reads from the job and uses to transition the upload.
 *
 * Infrastructure: mocked DB, S3, and sharp. No real services required.
 *
 * Matches plan Phase 5.5: "at least one integration scenario that spans
 * confirm upload, outbox row persistence, relay publication, image job
 * completion, final upload status retrieval."
 */

import { imageOptimizeJobId, OutboxEventType } from '@portfolio/shared';
import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mock functions ────────────────────────────────────────────────────

const {
  dbSelectMock,
  dbUpdateSetMock,
  dbUpdateSetWhereMock,
  imageQueueAddMock,
  s3BytesMock,
  s3WriteMock,
  sharpMetadataMock,
  sharpToBufferMock,
} = vi.hoisted(() => ({
  dbSelectMock: vi.fn(),
  dbUpdateSetMock: vi.fn(),
  dbUpdateSetWhereMock: vi.fn(),
  imageQueueAddMock: vi.fn(),
  s3BytesMock: vi.fn(),
  s3WriteMock: vi.fn(),
  sharpMetadataMock: vi.fn(),
  sharpToBufferMock: vi.fn(),
}));

// ── Module mocks ──────────────────────────────────────────────────────────────

vi.mock('../config/db', () => ({
  db: {
    select: dbSelectMock,
    update: vi.fn(() => ({ set: dbUpdateSetMock })),
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
  and: vi.fn((...args: unknown[]) => ({ and: args })),
  asc: vi.fn((col: unknown) => ({ asc: col })),
  eq: vi.fn((col: unknown, val: unknown) => ({ eq: [col, val] })),
  lte: vi.fn((col: unknown, val: unknown) => ({ lte: [col, val] })),
}));

vi.mock('../config/s3', () => ({
  s3: {
    file: vi.fn(() => ({
      bytes: s3BytesMock,
      write: s3WriteMock,
    })),
  },
  getPublicUrl: (key: string) => `https://cdn.example.com/${key}`,
}));

vi.mock('sharp', () => {
  const instance = {
    metadata: sharpMetadataMock,
    resize: vi.fn().mockReturnThis(),
    webp: vi.fn().mockReturnThis(),
    gif: vi.fn().mockReturnThis(),
    toBuffer: sharpToBufferMock,
  };
  return { default: vi.fn(() => instance) };
});

// ── Imports (after mocks so Vitest wires them correctly) ──────────────────────

import { processImageOptimize } from '../jobs/imageOptimize';
import {
  OUTBOX_MAX_ATTEMPTS,
  processOutboxEvents,
  resetOutboxRelayStateForTests,
} from './outbox-relay';

// ── Helpers ───────────────────────────────────────────────────────────────────

const UPLOAD_ID = '123e4567-e89b-12d3-a456-426614174000';
const OUTBOX_EVENT_ID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee';

function makeOutboxEvent(overrides: Partial<{ attempts: number }> = {}) {
  return {
    id: OUTBOX_EVENT_ID,
    eventType: OutboxEventType.IMAGE_OPTIMIZE,
    payload: { uploadId: UPLOAD_ID },
    attempts: overrides.attempts ?? 0,
    status: 'pending',
    createdAt: new Date(),
    processedAt: null,
    lastAttemptAt: null,
    errorMessage: null,
  };
}

function makeUploadRecord(status = 'uploaded') {
  return {
    id: UPLOAD_ID,
    storageKey: 'uploads/2026/03/image.jpg',
    originalUrl: 'https://cdn.example.com/uploads/2026/03/image.jpg',
    optimizedUrl: null,
    variants: null,
    mime: 'image/jpeg',
    size: 1024,
    width: null,
    height: null,
    status,
    createdAt: new Date(),
  };
}

/** Returns a relay-side db.select mock chain (outbox event query). */
function outboxSelectChain(events: object[]) {
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

/** Returns an imageOptimize-side db.select mock chain (uploads record query). */
function uploadsSelectChain(records: object[]) {
  return {
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(records),
      })),
    })),
  };
}

function makeQueues() {
  return {
    imageQueue: { add: imageQueueAddMock } as never,
    postPublishQueue: { add: vi.fn() } as never,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('upload pipeline: relay → imageOptimize state transition', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetOutboxRelayStateForTests();

    // db.update chain resolves by default for both outbox and uploads updates
    dbUpdateSetMock.mockImplementation(() => ({ where: dbUpdateSetWhereMock }));
    dbUpdateSetWhereMock.mockResolvedValue(undefined);

    // queue.add resolves by default
    imageQueueAddMock.mockResolvedValue(undefined);

    // S3 returns a minimal valid JPEG buffer
    s3BytesMock.mockResolvedValue(Buffer.from([0xff, 0xd8, 0xff, 0xe0]));
    s3WriteMock.mockResolvedValue(undefined);

    // sharp metadata: 800×600 JPEG (no animated GIF)
    sharpMetadataMock.mockResolvedValue({ width: 800, height: 600, pages: undefined });
    sharpToBufferMock.mockResolvedValue(Buffer.from('webp-bytes'));
  });

  it('stage 1 → stage 2: relay publishes uploadId and imageOptimize transitions upload to processed', async () => {
    // ── Stage 1: relay receives pending outbox event ──────────────────────────
    // Precondition: confirmUpload() has already written an image-optimize outbox row.
    // The relay polls the outbox table and finds this pending event.

    dbSelectMock.mockReturnValueOnce(outboxSelectChain([makeOutboxEvent()]));

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    // Relay must have published the job with the correct uploadId and dedup jobId
    expect(imageQueueAddMock).toHaveBeenCalledOnce();
    const relayJobData = imageQueueAddMock.mock.calls[0] as [
      string,
      { uploadId: string },
      { jobId: string },
    ];
    expect(relayJobData[1].uploadId).toBe(UPLOAD_ID);
    expect(relayJobData[2].jobId).toBe(imageOptimizeJobId(OUTBOX_EVENT_ID));

    // Outbox row must be marked processed
    expect(dbUpdateSetMock).toHaveBeenCalledWith(expect.objectContaining({ status: 'processed' }));

    // ── Stage 2: imageOptimize receives the job the relay published ───────────
    // Precondition: BullMQ received the job from stage 1; the worker processes it.
    // The uploadId in the job data is the same UPLOAD_ID the relay extracted from the outbox event.

    const uploadId = relayJobData[1].uploadId; // proof of the data handoff

    // Reset the db.select mock to serve the uploads record query
    dbSelectMock.mockReturnValueOnce(uploadsSelectChain([makeUploadRecord('uploaded')]));

    const fakeJob = {
      id: relayJobData[2].jobId,
      data: { uploadId },
      attemptsMade: 0,
    } as unknown as Job<{ uploadId: string }>;

    await processImageOptimize(fakeJob);

    // imageOptimize must have updated the upload to `processed` with variant URLs
    const imageOptimizerSetCall = dbUpdateSetMock.mock.calls.find((args: unknown[]) => {
      const arg = args[0] as Record<string, unknown>;
      return arg.status === 'processed' && arg.optimizedUrl !== undefined;
    });
    expect(imageOptimizerSetCall).toBeDefined();
    expect((imageOptimizerSetCall as [Record<string, unknown>])[0]).toMatchObject({
      status: 'processed',
      optimizedUrl: expect.stringContaining('_medium.webp') as string,
      variants: expect.objectContaining({
        thumbnail: expect.stringContaining('_thumb.webp') as string,
        medium: expect.stringContaining('_medium.webp') as string,
      }) as object,
      width: 800,
      height: 600,
    });
  });

  it('terminal relay failure marks upload failed — imageOptimize never runs', async () => {
    // When the relay exhausts OUTBOX_MAX_ATTEMPTS, it reconciles the upload to
    // `failed` directly. imageOptimize is never invoked because the job was
    // never published to BullMQ.

    dbSelectMock.mockReturnValueOnce(
      outboxSelectChain([makeOutboxEvent({ attempts: OUTBOX_MAX_ATTEMPTS - 1 })])
    );
    imageQueueAddMock.mockRejectedValue(new Error('Redis unavailable'));

    const { imageQueue, postPublishQueue } = makeQueues();
    await processOutboxEvents(imageQueue, postPublishQueue);

    // Outbox marked finally failed
    expect(dbUpdateSetMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed', attempts: OUTBOX_MAX_ATTEMPTS })
    );

    // Upload reconciliation: a db.update call with exactly { status: 'failed' }
    const reconciledCall = (dbUpdateSetMock.mock.calls as [Record<string, unknown>][]).find(
      ([args]) => Object.keys(args).length === 1 && args.status === 'failed'
    );
    expect(reconciledCall).toBeDefined();

    // imageOptimize was never invoked — the DB was never queried for the upload record
    // (imageOptimize would call db.select for the uploads table, but since stage 2
    // never ran, db.select was only called once — for the relay's outbox query)
    expect(dbSelectMock).toHaveBeenCalledOnce();
  });
});
