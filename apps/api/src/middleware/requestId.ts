import type { Context, Next } from 'hono';
import type { AppEnv } from '../types/index';

/**
 * Middleware: inject a unique request ID into every request.
 * Sets c.get('requestId') and X-Request-Id response header.
 */
export async function requestId(c: Context<AppEnv>, next: Next): Promise<void> {
  const id = crypto.randomUUID();
  c.set('requestId', id);
  c.header('X-Request-Id', id);
  await next();
}
