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
 * Counts are derived via CTE to avoid materialising large arrays of IDs.
 */

import { sql } from 'drizzle-orm';
import { db } from '../config/db';
import { getLogger } from '../config/logger';

const logger = getLogger('jobs', 'retention');

const ANONYMIZED_EMAIL = 'anonymized@removed.local';
const RETENTION_DAYS = 90;

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
    const [row] = await db.execute<{ count: number }>(
      sql`WITH d AS (DELETE FROM contacts WHERE created_at < ${cutoff} RETURNING 1)
          SELECT COUNT(*)::int AS count FROM d`
    );
    contactsDeleted = row?.count ?? 0;
  } catch (err) {
    const msg = (err as Error).message;
    logger.error('Retention: failed to delete old contacts', { error: msg });
    stepErrors.push(`contacts: ${msg}`);
  }

  // 2. Anonymize author_email on old comments
  try {
    const [row] = await db.execute<{ count: number }>(
      sql`WITH d AS (
            UPDATE comments
            SET author_email = ${ANONYMIZED_EMAIL}
            WHERE created_at < ${cutoff}
              AND author_email != ${ANONYMIZED_EMAIL}
            RETURNING 1
          )
          SELECT COUNT(*)::int AS count FROM d`
    );
    commentsAnonymized = row?.count ?? 0;
  } catch (err) {
    const msg = (err as Error).message;
    logger.error('Retention: failed to anonymize comment emails', { error: msg });
    stepErrors.push(`comments: ${msg}`);
  }

  // 3. Delete analytics events older than 90 days
  try {
    const [row] = await db.execute<{ count: number }>(
      sql`WITH d AS (DELETE FROM analytics_events WHERE created_at < ${cutoff} RETURNING 1)
          SELECT COUNT(*)::int AS count FROM d`
    );
    eventsDeleted = row?.count ?? 0;
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
