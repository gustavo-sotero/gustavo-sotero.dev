/**
 * Service layer for public contact form submissions.
 *
 * Owns the domain flow for:
 *   1. Accepted-body validation.
 *   2. Honeypot no-op success.
 *   3. Turnstile verification.
 *   4. Contact persistence.
 *   5. Best-effort Telegram enqueue.
 *
 * The public contact route is responsible only for:
 *   - Request body parsing.
 *   - Client IP extraction from request context.
 *   - Mapping domain errors to HTTP responses.
 */

import { createContactSchema } from '@portfolio/shared/schemas/contacts';
import { DomainValidationError } from '../lib/errors';
import { enqueueTelegramNotification } from '../lib/queues';
import { validateTurnstile } from '../lib/turnstile';
import { createContact } from '../repositories/contacts.repo';

export interface SubmitContactInput {
  body: unknown;
  ip: string;
  requestId?: string;
}

export interface SubmitContactResult {
  message: string;
}

function isFilledHoneypot(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  if (!('website' in body)) return false;
  return typeof body.website === 'string' && body.website.trim().length > 0;
}

function parseContactBody(body: unknown) {
  const parsed = createContactSchema.safeParse(body);

  if (parsed.success) {
    return parsed.data;
  }

  throw new DomainValidationError(
    'Invalid request body',
    parsed.error.issues.map((issue) => ({
      field: issue.path.join('.'),
      message: issue.message,
    }))
  );
}

/**
 * Validate, persist, and notify for a public contact submission.
 * Honeypot hits return a fake success without persistence.
 * Notification dispatch is fire-and-forget and never blocks success.
 */
export async function submitContact(input: SubmitContactInput): Promise<SubmitContactResult> {
  if (isFilledHoneypot(input.body)) {
    return { message: 'Message received' };
  }

  const payload = parseContactBody(input.body);

  const turnstileValid = await validateTurnstile(payload.turnstileToken, input.ip, {
    requestId: input.requestId,
  });

  if (!turnstileValid) {
    throw new DomainValidationError('Security verification failed', [
      {
        field: 'turnstileToken',
        message: 'Security verification failed',
      },
    ]);
  }

  const { name, email, message } = payload;

  await createContact({ name, email, message });

  void enqueueTelegramNotification({
    type: 'contact',
    name,
    email,
    messagePreview: message.slice(0, 200),
  });

  return { message: 'Message sent successfully' };
}
