/**
 * Cloudflare Turnstile server-side validation helper.
 *
 * Validates a Turnstile token against the Cloudflare siteverify API.
 * Returns true if the challenge was solved by a real user, false otherwise.
 *
 * Tests that exercise routes using Turnstile must mock this module explicitly:
 *   vi.mock('../../lib/turnstile', () => ({ validateTurnstile: vi.fn().mockResolvedValue(true) }))
 */

import { env } from '../config/env';
import { getLogger } from '../config/logger';

const logger = getLogger('turnstile');

const SITEVERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

interface TurnstileResponse {
  success: boolean;
  'error-codes'?: string[];
  challenge_ts?: string;
  hostname?: string;
}

interface TurnstileValidationContext {
  requestId?: string;
}

type TurnstileFailureType = 'timeout' | 'aborted' | 'network' | 'unknown';

function classifyTurnstileFailure(err: unknown): TurnstileFailureType {
  if (!(err instanceof Error)) return 'unknown';
  if (err.name === 'TimeoutError') return 'timeout';
  if (err.name === 'AbortError') return 'aborted';
  if (err instanceof TypeError) return 'network';
  return 'unknown';
}

/**
 * Validate a Cloudflare Turnstile token.
 *
 * @param token  - The turnstile_token received in the request body.
 * @param ip     - The client IP address (sent as remoteip to improve accuracy).
 * @returns      `true` when the challenge is valid, `false` otherwise.
 */
export async function validateTurnstile(
  token: string,
  ip: string,
  context: TurnstileValidationContext = {}
): Promise<boolean> {
  try {
    const res = await fetch(SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        secret: env.TURNSTILE_SECRET,
        response: token,
        remoteip: ip,
      }),
      signal: AbortSignal.timeout(5_000),
    });

    if (!res.ok) {
      logger.warn('Turnstile siteverify HTTP error', {
        requestId: context.requestId,
        status: res.status,
      });
      return false;
    }

    const data = (await res.json()) as TurnstileResponse;

    if (!data.success) {
      logger.info('Turnstile challenge failed', {
        requestId: context.requestId,
        errorCodes: data['error-codes'],
        hostname: data.hostname,
      });
    }

    return data.success === true;
  } catch (err) {
    const failureType = classifyTurnstileFailure(err);
    logger.error('Turnstile validation threw an exception', {
      requestId: context.requestId,
      failureType,
      error: err instanceof Error ? err.message : String(err),
    });
    // Fail closed: treat exceptions as invalid tokens
    return false;
  }
}
