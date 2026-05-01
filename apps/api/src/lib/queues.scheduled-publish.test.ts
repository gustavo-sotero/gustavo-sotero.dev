import {
  legacyScheduledPostPublishJobId,
  scheduledPostPublishJobId,
} from '@portfolio/shared/lib/jobIds';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { loggerInfoMock, postPublishQueueAddMock, postPublishQueueGetJobMock } = vi.hoisted(() => ({
  loggerInfoMock: vi.fn(),
  postPublishQueueAddMock: vi.fn(),
  postPublishQueueGetJobMock: vi.fn(),
}));

vi.mock('../config/logger', () => ({
  getLogger: () => ({
    info: loggerInfoMock,
    error: vi.fn(),
  }),
}));

vi.mock('bullmq', () => {
  const MockQueue = vi.fn().mockImplementation(function MockQueue(this: {
    add: typeof postPublishQueueAddMock;
    getJob: typeof postPublishQueueGetJobMock;
  }) {
    this.add = postPublishQueueAddMock;
    this.getJob = postPublishQueueGetJobMock;
  });

  return { Queue: MockQueue };
});

import { cancelScheduledPostPublish, enqueueScheduledPostPublish } from './queues';

type MockJobState = 'delayed' | 'waiting' | 'active' | 'completed';

interface MockJob {
  opts: { jobId: string };
  getState: ReturnType<typeof vi.fn>;
  remove: ReturnType<typeof vi.fn>;
  changeDelay: ReturnType<typeof vi.fn>;
}

function makeJob(state: MockJobState, jobId: string): MockJob {
  return {
    opts: { jobId },
    getState: vi.fn().mockResolvedValue(state),
    remove: vi.fn().mockResolvedValue(undefined),
    changeDelay: vi.fn().mockResolvedValue(undefined),
  };
}

describe('scheduled publish queue helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('enqueues scheduled publish with BullMQ-safe deterministic jobId', async () => {
    postPublishQueueGetJobMock.mockResolvedValueOnce(null);
    postPublishQueueAddMock.mockResolvedValueOnce({ id: 'job-1' });

    const postId = 77;
    const scheduledAt = new Date(Date.now() + 60_000);

    await enqueueScheduledPostPublish(postId, scheduledAt);

    expect(postPublishQueueGetJobMock).toHaveBeenCalledWith(scheduledPostPublishJobId(postId));
    expect(postPublishQueueAddMock).toHaveBeenCalledWith(
      'publish',
      { postId },
      expect.objectContaining({ jobId: scheduledPostPublishJobId(postId) })
    );
  });

  it('cancelScheduledPostPublish removes delayed job using new format first', async () => {
    const postId = 42;
    const job = makeJob('delayed', scheduledPostPublishJobId(postId));

    postPublishQueueGetJobMock.mockResolvedValueOnce(job);

    await cancelScheduledPostPublish(postId);

    expect(postPublishQueueGetJobMock).toHaveBeenCalledTimes(1);
    expect(postPublishQueueGetJobMock).toHaveBeenCalledWith(scheduledPostPublishJobId(postId));
    expect(job.remove).toHaveBeenCalledTimes(1);
  });

  it('cancelScheduledPostPublish falls back to legacy format lookup and removes legacy delayed job', async () => {
    const postId = 9;
    const legacyJobId = legacyScheduledPostPublishJobId(postId);
    const legacyJob = makeJob('delayed', legacyJobId);

    postPublishQueueGetJobMock.mockResolvedValueOnce(null).mockResolvedValueOnce(legacyJob);

    await cancelScheduledPostPublish(postId);

    expect(postPublishQueueGetJobMock).toHaveBeenNthCalledWith(
      1,
      scheduledPostPublishJobId(postId)
    );
    expect(postPublishQueueGetJobMock).toHaveBeenNthCalledWith(2, legacyJobId);
    expect(legacyJob.remove).toHaveBeenCalledTimes(1);
    expect(loggerInfoMock).toHaveBeenCalledWith(
      'Cancelled post-publish job',
      expect.objectContaining({
        jobId: legacyJobId,
        jobIdFormat: 'legacy',
        postId,
      })
    );
  });

  it('cancelScheduledPostPublish keeps non-cancelable states untouched', async () => {
    const postId = 11;
    const activeJob = makeJob('active', scheduledPostPublishJobId(postId));

    postPublishQueueGetJobMock.mockResolvedValueOnce(activeJob);

    await cancelScheduledPostPublish(postId);

    expect(activeJob.getState).toHaveBeenCalledTimes(1);
    expect(activeJob.remove).not.toHaveBeenCalled();
  });

  it('cancelScheduledPostPublish does not log a cancellation for legacy jobs in non-cancelable states', async () => {
    const postId = 13;
    const legacyJobId = legacyScheduledPostPublishJobId(postId);
    const legacyActiveJob = makeJob('active', legacyJobId);

    postPublishQueueGetJobMock.mockResolvedValueOnce(null).mockResolvedValueOnce(legacyActiveJob);

    await cancelScheduledPostPublish(postId);

    expect(legacyActiveJob.getState).toHaveBeenCalledTimes(1);
    expect(legacyActiveJob.remove).not.toHaveBeenCalled();
    expect(loggerInfoMock).not.toHaveBeenCalledWith(
      'Cancelled post-publish job',
      expect.objectContaining({ jobId: legacyJobId })
    );
  });
});
