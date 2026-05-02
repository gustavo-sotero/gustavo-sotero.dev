import { Hono } from 'hono';
import { DomainValidationError } from '../../lib/errors';
import { parseBodyResult } from '../../lib/requestBody';
import { errorResponse, successResponse } from '../../lib/response';
import { createRateLimit, getClientIp } from '../../middleware/rateLimit';
import { submitContact } from '../../services/contact.service';
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

  try {
    const result = await submitContact({
      body: bodyResult.data,
      ip: getClientIp(c),
      requestId: c.get('requestId') as string | undefined,
    });

    return successResponse(c, result, 201);
  } catch (err) {
    if (err instanceof DomainValidationError) {
      return errorResponse(c, 400, 'VALIDATION_ERROR', err.message, err.details);
    }

    throw err;
  }
});

export { contactRouter };
