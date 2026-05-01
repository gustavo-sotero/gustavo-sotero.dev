/**
 * Service layer for public contact form submissions.
 *
 * Owns the domain flow after HTTP-level checks (body parsing, honeypot, Turnstile)
 * complete in the route:
 *   1. Persist the contact record.
 *   2. Enqueue a best-effort Telegram notification (fire-and-forget).
 *
 * The public contact route is responsible only for:
 *   - Request parsing and schema validation
 *   - Honeypot check (HTTP request shape concern)
 *   - Turnstile verification (browser token, HTTP-level concern)
 *   - IP extraction from request context
 *   - Mapping service results to HTTP responses
 */

import { enqueueTelegramNotification } from '../lib/queues';
import { createContact } from '../repositories/contacts.repo';

export interface SubmitContactInput {
  name: string;
  email: string;
  message: string;
}

/**
 * Persist a contact record and enqueue an admin notification.
 * Notification dispatch is fire-and-forget — a failure to enqueue does not
 * block the success response.
 */
export async function submitContact(input: SubmitContactInput): Promise<void> {
  const { name, email, message } = input;

  await createContact({ name, email, message });

  void enqueueTelegramNotification({
    type: 'contact',
    name,
    email,
    messagePreview: message.slice(0, 200),
  });
}
