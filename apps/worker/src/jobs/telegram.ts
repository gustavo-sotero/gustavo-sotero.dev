/**
 * BullMQ job handler: telegram-notifications
 *
 * Formats and sends Telegram notifications for:
 *  - New pending comments (`type: 'comment'`)
 *  - New contact form submissions (`type: 'contact'`)
 *
 * On failure, throws to trigger BullMQ retry (up to 5 attempts with
 * exponential backoff). On permanent failure the caller (`index.ts`)
 * moves the job to the telegram-notifications-dlq.
 */

import type { Job } from 'bullmq';
import { getLogger } from '../config/logger';
import { sendTelegramMessage } from '../lib/telegram';

const logger = getLogger('jobs', 'telegram');

export interface TelegramJobPayload {
  type: 'comment' | 'contact';
  // comment fields
  postTitle?: string;
  authorName?: string;
  contentPreview?: string;
  // contact fields
  name?: string;
  email?: string;
  messagePreview?: string;
}

/**
 * Escape special Markdown characters so the text renders correctly.
 * Only used for user-supplied content inserted into Markdown strings.
 */
function escapeMd(text: string | undefined | null): string {
  if (!text) return '';
  // Escape characters that have special meaning in Telegram Markdown v1
  return text.replace(/([_*`[\]])/g, '\\$1');
}

export async function processTelegram(job: Job<TelegramJobPayload>): Promise<void> {
  const { type } = job.data;

  logger.info('Telegram job started', {
    jobId: job.id,
    type,
    attempt: job.attemptsMade + 1,
  });

  let text: string;

  if (type === 'comment') {
    const postTitle = escapeMd(job.data.postTitle);
    const authorName = escapeMd(job.data.authorName);
    const contentPreview = escapeMd(job.data.contentPreview);

    text = [
      '📝 *New comment pending moderation*',
      `Post: ${postTitle}`,
      `Author: ${authorName}`,
      contentPreview ? `Preview: ${contentPreview}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  } else if (type === 'contact') {
    const name = escapeMd(job.data.name);
    const email = escapeMd(job.data.email);
    const messagePreview = escapeMd(job.data.messagePreview);

    text = [
      '✉️ *New contact message*',
      `Name: ${name}`,
      `Email: ${email}`,
      messagePreview ? `Preview: ${messagePreview}` : '',
    ]
      .filter(Boolean)
      .join('\n');
  } else {
    logger.warn('Unknown Telegram job type — skipping', { type, jobId: job.id });
    return;
  }

  await sendTelegramMessage(text);

  logger.info('Telegram job completed', { jobId: job.id, type });
}
