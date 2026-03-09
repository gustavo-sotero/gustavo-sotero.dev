/**
 * Telegram Bot API helper for the Worker process.
 *
 * Sends a message to a configured Telegram chat via the Bot API.
 * Throws on non-OK responses so BullMQ can retry the job.
 */

import { env } from '../config/env';
import { getLogger } from '../config/logger';

const logger = getLogger('lib', 'telegram');

type ParseMode = 'MarkdownV2' | 'Markdown' | 'HTML';

/**
 * Send a text message to the configured Telegram chat.
 *
 * @throws Error if the Telegram API returns a non-OK response — triggers BullMQ retry.
 */
export async function sendTelegramMessage(
  text: string,
  parseMode: ParseMode = 'Markdown'
): Promise<void> {
  const url = `https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: env.TELEGRAM_CHAT_ID,
      text,
      parse_mode: parseMode,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => '<unreadable>');
    logger.error('Telegram API returned non-OK status', {
      status: response.status,
      body,
    });
    throw new Error(`Telegram API error: HTTP ${response.status} — ${body}`);
  }

  logger.debug('Telegram message sent successfully');
}
