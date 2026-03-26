import { createContactSchema } from '@portfolio/shared/schemas/contacts';
import { Hono } from 'hono';
import { enqueueTelegramNotification } from '../../lib/queues';
import { parseBodyResult } from '../../lib/requestBody';
import { errorResponse, successResponse } from '../../lib/response';
import { validateTurnstile } from '../../lib/turnstile';
import { validateBody } from '../../lib/validate';
import { createRateLimit, getClientIp } from '../../middleware/rateLimit';
import { createContact } from '../../repositories/contacts.repo';
import type { AppEnv } from '../../types/index';

const contactRouter = new Hono<AppEnv>();

const contactRateLimit = createRateLimit({
  maxRequests: 5,
  windowMs: 60_000,
  keyPrefix: 'rl:contact',
});

contactRouter.post('/', contactRateLimit, async (c) => {
  const bodyResult = await parseBodyResult(c);
  if (!bodyResult.ok) {
    return errorResponse(
      c,
      400,
      'VALIDATION_ERROR',
      bodyResult.error.message,
      bodyResult.error.details
    );
  }

  const body = bodyResult.data;

  // Honeypot check — bots typically fill hidden fields; silently reject without persisting
  if (
    body &&
    typeof body === 'object' &&
    'website' in body &&
    typeof body.website === 'string' &&
    body.website.trim().length > 0
  ) {
    return successResponse(c, { message: 'Message received' }, 201);
  }

  const bv = validateBody(c, createContactSchema, bodyResult);
  if (!bv.ok) return bv.response;

  const payload = bv.data;

  // Validate Turnstile token
  const ip = getClientIp(c);
  const turnstileValid = await validateTurnstile(payload.turnstileToken, ip, {
    requestId: c.get('requestId'),
  });
  if (!turnstileValid) {
    return errorResponse(c, 400, 'VALIDATION_ERROR', 'Security verification failed');
  }

  await createContact({
    name: payload.name,
    email: payload.email,
    message: payload.message,
  });

  // Fire-and-forget: notify admin via Telegram — do not await so enqueue latency
  // never blocks the 201 response. Failures are handled inside the job queue.
  void enqueueTelegramNotification({
    type: 'contact',
    name: payload.name,
    email: payload.email,
    messagePreview: payload.message.slice(0, 200),
  });

  return successResponse(c, { message: 'Message sent successfully' }, 201);
});

export { contactRouter };
