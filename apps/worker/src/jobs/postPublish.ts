/**
 * BullMQ job handler: post-publish
 *
 * Promotes a `scheduled` post to `published` at the designated time.
 *
 * Safety guarantees:
 *  - Validates the post still exists, is not deleted, and is still `scheduled`.
 *  - Validates the scheduled window is reached (`scheduledAt <= now`).
 *  - Idempotent: if the post is already published, exits cleanly without error.
 *
 * On failure: throws to trigger BullMQ retry (up to 3 attempts with
 * exponential backoff — configured at queue level).
 */

import { posts } from '@portfolio/shared/db/schema';
import { DelayedError, type Job } from 'bullmq';
import { and, eq, isNull, lte, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { getLogger } from '../config/logger';
import { invalidatePattern } from '../lib/cache';

const logger = getLogger('jobs', 'postPublish');

export interface PostPublishJobData {
  postId: number;
}

export async function processPostPublish(
  job: Job<PostPublishJobData>,
  token?: string
): Promise<void> {
  const { postId } = job.data;

  logger.info('Post-publish job started', {
    jobId: job.id,
    postId,
    attempt: job.attemptsMade + 1,
  });

  // 1. Fetch the post
  const [post] = await db
    .select({
      id: posts.id,
      slug: posts.slug,
      status: posts.status,
      scheduledAt: posts.scheduledAt,
      deletedAt: posts.deletedAt,
      publishedAt: posts.publishedAt,
    })
    .from(posts)
    .where(eq(posts.id, postId))
    .limit(1);

  // 2. Post not found — nothing to do
  if (!post) {
    logger.warn('Post-publish job: post not found — skipping', { jobId: job.id, postId });
    return;
  }

  // 3. Post was deleted — skip silently
  if (post.deletedAt !== null) {
    logger.warn('Post-publish job: post is deleted — skipping', { jobId: job.id, postId });
    return;
  }

  // 4. Idempotency: already published — skip
  if (post.status === 'published') {
    logger.info('Post-publish job: post already published — skipping', { jobId: job.id, postId });
    return;
  }

  // 5. Post is no longer scheduled (e.g. admin changed to draft manually)
  if (post.status !== 'scheduled') {
    logger.info('Post-publish job: post status is no longer scheduled — skipping', {
      jobId: job.id,
      postId,
      currentStatus: post.status,
    });
    return;
  }

  // 6. Validate temporal window: scheduledAt must be set and <= now
  if (!post.scheduledAt) {
    // scheduledAt should never be null for a scheduled post; treat as a data integrity issue
    throw new Error(`Post ${postId} has status 'scheduled' but scheduledAt is null`);
  }

  if (post.scheduledAt.getTime() > Date.now()) {
    // An outdated job fired before the DB-authoritative deadline (e.g. admin rescheduled
    // to a later date). Re-delay this job to the correct timestamp instead of consuming
    // a retry attempt — this is expected behaviour under normal reschedule flows.
    if (!token) {
      throw new Error(
        `Post ${postId}: scheduledAt is still in the future but no BullMQ token was provided ` +
          'for moveToDelayed(). Ensure the worker bootstrap passes the token argument to processPostPublish.'
      );
    }

    const targetTimestamp = post.scheduledAt.getTime();
    await job.moveToDelayed(targetTimestamp, token);
    logger.info('Post-publish job: moved back to delayed queue', {
      jobId: job.id,
      postId,
      scheduledAt: post.scheduledAt.toISOString(),
      action: 'moved-back-to-delayed',
      nextDelayMs: targetTimestamp - Date.now(),
    });
    throw new DelayedError();
  }

  // 7. Promote to published — only update if still in scheduled state (race-safe CAS)
  const [updated] = await db
    .update(posts)
    .set({
      status: 'published',
      publishedAt: new Date(),
      scheduledAt: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(posts.id, postId),
        eq(posts.status, 'scheduled'),
        isNull(posts.deletedAt),
        lte(posts.scheduledAt, sql`now()`)
      )
    )
    .returning({ id: posts.id, slug: posts.slug });

  if (!updated) {
    // CAS check failed — another worker may have handled it concurrently
    logger.warn('Post-publish job: CAS update matched 0 rows — likely already handled', {
      jobId: job.id,
      postId,
    });
    return;
  }

  logger.info('Post-publish job: post published successfully', {
    jobId: job.id,
    postId,
    slug: updated.slug,
  });

  // Non-transactional best-effort cache invalidation. The DB commit above is
  // the authoritative success boundary — invalidation failure does not revert
  // the publish and must not fail the job (would trigger BullMQ retry with an
  // already-committed state). Stale cache entries expire at their TTL.
  await Promise.all([
    invalidatePattern('posts:*'),
    invalidatePattern('tags:*'),
    invalidatePattern('feed:*'),
    invalidatePattern('sitemap:*'),
  ]);
}
