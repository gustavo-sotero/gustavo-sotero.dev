/**
 * BullMQ job handler: data-retention (daily cron at 03:00 UTC)
 *
 * Enforces the 90-day data retention policy defined in the PRD:
 *  1. Delete contacts older than 90 days
 *  2. Anonymize `author_email` on comments older than 90 days
 *  3. Delete analytics_events older than 90 days
 *
 * Each operation is independent — a failure in one does not block the others.
 * All step failures are accumulated and re-thrown as `RetentionCleanupError`
 * so BullMQ can retry the job and the error surfaces in observability tooling.
 *
 * Counts are derived via bounded CTE batches to avoid materialising large
 * arrays of IDs and to keep long-running cleanup locks short.
 */

import { sql } from 'drizzle-orm';
import { db } from '../config/db';
import { getLogger } from '../config/logger';

const logger = getLogger('jobs', 'retention');

const ANONYMIZED_EMAIL = 'anonymized@removed.local';
const RETENTION_DAYS = 90;
const RETENTION_BATCH_SIZE = 500;

async function runBatchedCleanup(executeBatch: () => Promise<number>): Promise<number> {
  let totalAffected = 0;

  while (true) {
    const batchCount = await executeBatch();
    totalAffected += batchCount;

    if (batchCount < RETENTION_BATCH_SIZE) {
      return totalAffected;
    }
  }
}

async function deleteOldContactsBatch(cutoff: Date): Promise<number> {
  const [row] = await db.execute<{ count: number }>(sql`
    WITH batch AS (
      SELECT id
      FROM contacts
      WHERE created_at < ${cutoff}
      ORDER BY created_at ASC
      LIMIT ${RETENTION_BATCH_SIZE}
    ),
    deleted AS (
      DELETE FROM contacts
      WHERE id IN (SELECT id FROM batch)
      RETURNING 1
    )
    SELECT COUNT(*)::int AS count FROM deleted
  `);

  return row?.count ?? 0;
}

async function anonymizeOldCommentsBatch(cutoff: Date): Promise<number> {
  const [row] = await db.execute<{ count: number }>(sql`
    WITH batch AS (
      SELECT id
      FROM comments
      WHERE created_at < ${cutoff}
        AND author_email != ${ANONYMIZED_EMAIL}
      ORDER BY created_at ASC
      LIMIT ${RETENTION_BATCH_SIZE}
    ),
    updated AS (
      UPDATE comments
      SET author_email = ${ANONYMIZED_EMAIL}
      WHERE id IN (SELECT id FROM batch)
      RETURNING 1
    )
    SELECT COUNT(*)::int AS count FROM updated
  `);

  return row?.count ?? 0;
}

async function deleteOldAnalyticsEventsBatch(cutoff: Date): Promise<number> {
  const [row] = await db.execute<{ count: number }>(sql`
    WITH batch AS (
      SELECT id
      FROM analytics_events
      WHERE created_at < ${cutoff}
      ORDER BY created_at ASC
      LIMIT ${RETENTION_BATCH_SIZE}
    ),
    deleted AS (
      DELETE FROM analytics_events
      WHERE id IN (SELECT id FROM batch)
      RETURNING 1
    )
    SELECT COUNT(*)::int AS count FROM deleted
  `);

  return row?.count ?? 0;
}

/** Thrown when one or more retention steps fail. Contains all step error messages. */
export class RetentionCleanupError extends Error {
  readonly stepErrors: string[];

  constructor(stepErrors: string[]) {
    super(`Retention job failed: ${stepErrors.join(' | ')}`);
    this.name = 'RetentionCleanupError';
    this.stepErrors = stepErrors;
  }
}

export async function processRetention(): Promise<void> {
  const startedAt = Date.now();
  const cutoff = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);

  logger.info('Retention job started', {
    cutoff: cutoff.toISOString(),
    retentionDays: RETENTION_DAYS,
  });

  let contactsDeleted = 0;
  let commentsAnonymized = 0;
  let eventsDeleted = 0;

  const stepErrors: string[] = [];

  // 1. Delete contacts older than 90 days
  try {
    contactsDeleted = await runBatchedCleanup(() => deleteOldContactsBatch(cutoff));
  } catch (err) {
    const msg = (err as Error).message;
    logger.error('Retention: failed to delete old contacts', { error: msg });
    stepErrors.push(`contacts: ${msg}`);
  }

  // 2. Anonymize author_email on old comments
  try {
    commentsAnonymized = await runBatchedCleanup(() => anonymizeOldCommentsBatch(cutoff));
  } catch (err) {
    const msg = (err as Error).message;
    logger.error('Retention: failed to anonymize comment emails', { error: msg });
    stepErrors.push(`comments: ${msg}`);
  }

  // 3. Delete analytics events older than 90 days
  try {
    eventsDeleted = await runBatchedCleanup(() => deleteOldAnalyticsEventsBatch(cutoff));
  } catch (err) {
    const msg = (err as Error).message;
    logger.error('Retention: failed to delete old analytics events', { error: msg });
    stepErrors.push(`analytics_events: ${msg}`);
  }

  const durationMs = Date.now() - startedAt;

  logger.info('Retention job completed', {
    contactsDeleted,
    commentsAnonymized,
    eventsDeleted,
    durationMs,
    cutoff: cutoff.toISOString(),
    ...(stepErrors.length > 0 && { failedSteps: stepErrors }),
  });

  if (stepErrors.length > 0) {
    throw new RetentionCleanupError(stepErrors);
  }
}
