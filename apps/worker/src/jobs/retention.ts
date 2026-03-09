/**
 * BullMQ job handler: data-retention (daily cron at 03:00 UTC)
 *
 * Enforces the 90-day data retention policy defined in the PRD:
 *  1. Delete contacts older than 90 days
 *  2. Anonymize `author_email` on comments older than 90 days
 *  3. Delete analytics_events older than 90 days
 *
 * Each operation is independent — a failure in one does not block the others.
 * Affected row counts are logged for audit.
 */

import { analyticsEvents, comments, contacts } from '@portfolio/shared/db/schema';
import { and, lt, ne } from 'drizzle-orm';
import { db } from '../config/db';
import { getLogger } from '../config/logger';

const logger = getLogger('jobs', 'retention');

const ANONYMIZED_EMAIL = 'anonymized@removed.local';
const RETENTION_DAYS = 90;

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

  // 1. Delete contacts older than 90 days
  try {
    const deleted = await db
      .delete(contacts)
      .where(lt(contacts.createdAt, cutoff))
      .returning({ id: contacts.id });
    contactsDeleted = deleted.length;
  } catch (err) {
    logger.error('Retention: failed to delete old contacts', {
      error: (err as Error).message,
    });
  }

  // 2. Anonymize author_email on old comments
  try {
    const updated = await db
      .update(comments)
      .set({ authorEmail: ANONYMIZED_EMAIL })
      .where(and(lt(comments.createdAt, cutoff), ne(comments.authorEmail, ANONYMIZED_EMAIL)))
      .returning({ id: comments.id });
    commentsAnonymized = updated.length;
  } catch (err) {
    logger.error('Retention: failed to anonymize comment emails', {
      error: (err as Error).message,
    });
  }

  // 3. Delete analytics events older than 90 days
  try {
    const deleted = await db
      .delete(analyticsEvents)
      .where(lt(analyticsEvents.createdAt, cutoff))
      .returning({ id: analyticsEvents.id });
    eventsDeleted = deleted.length;
  } catch (err) {
    logger.error('Retention: failed to delete old analytics events', {
      error: (err as Error).message,
    });
  }

  const durationMs = Date.now() - startedAt;

  logger.info('Retention job completed', {
    contactsDeleted,
    commentsAnonymized,
    eventsDeleted,
    durationMs,
    cutoff: cutoff.toISOString(),
  });
}
