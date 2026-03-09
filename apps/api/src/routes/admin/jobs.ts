/**
 * Admin routes for job queue monitoring.
 *
 * Routes:
 *  GET /admin/jobs/dlq - Returns failed job counts per DLQ queue
 */

import { Hono } from 'hono';
import { getLogger } from '../../config/logger';
import { imageDlqQueue, telegramDlqQueue } from '../../lib/queues';
import { errorResponse, successResponse } from '../../lib/response';
import type { AppEnv } from '../../types/index';

const adminJobsRouter = new Hono<AppEnv>();
const logger = getLogger('admin', 'jobs');

/**
 * GET /admin/jobs/dlq
 * Returns the count of failed jobs sitting in each dead-letter queue.
 * Responds with 503 if any queue is unreachable, so the dashboard never
 * silently shows stale/misleading zeros when Redis is down.
 */
adminJobsRouter.get('/dlq', async (c) => {
  let telegramFailed: Awaited<ReturnType<typeof telegramDlqQueue.getJobCounts>>;
  let imageFailed: Awaited<ReturnType<typeof imageDlqQueue.getJobCounts>>;

  try {
    [telegramFailed, imageFailed] = await Promise.all([
      telegramDlqQueue.getJobCounts('wait', 'active', 'failed', 'delayed', 'completed'),
      imageDlqQueue.getJobCounts('wait', 'active', 'failed', 'delayed', 'completed'),
    ]);
  } catch (err) {
    logger.error('Failed to retrieve DLQ job counts', {
      error: err instanceof Error ? err.message : String(err),
    });
    return errorResponse(c, 503, 'SERVICE_UNAVAILABLE', 'Failed to retrieve DLQ metrics');
  }

  const telegramTotal =
    (telegramFailed.wait ?? 0) +
    (telegramFailed.active ?? 0) +
    (telegramFailed.delayed ?? 0) +
    (telegramFailed.failed ?? 0);

  const imageTotal =
    (imageFailed.wait ?? 0) +
    (imageFailed.active ?? 0) +
    (imageFailed.delayed ?? 0) +
    (imageFailed.failed ?? 0);

  return successResponse(c, {
    queues: [
      {
        name: 'telegram-notifications-dlq',
        counts: telegramFailed,
        total: telegramTotal,
      },
      {
        name: 'image-optimize-dlq',
        counts: imageFailed,
        total: imageTotal,
      },
    ],
    totalFailed: telegramTotal + imageTotal,
  });
});

export { adminJobsRouter };
