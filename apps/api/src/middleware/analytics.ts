/**
 * Analytics middleware — intercepts public GET requests and enqueues an
 * analytics event after the response is sent (non-blocking).
 *
 * Excluded paths (technical/non-content):
 *   /health, /ready, /feed.xml, /sitemap.xml, /doc, /doc/*
 */

import type { Context, Next } from 'hono';
import { getClientIp } from '../lib/ip';
import { enqueueAnalyticsEvent } from '../lib/queues';
import type { AppEnv } from '../types/index';

/** Paths that should never generate analytics events. */
const EXCLUDED_PATHS = new Set([
  '/health',
  '/ready',
  '/feed.xml',
  '/sitemap.xml',
  '/doc',
  '/doc/spec',
]);

export async function analyticsMiddleware(c: Context<AppEnv>, next: Next): Promise<void> {
  await next();

  // Only track GET requests on non-excluded paths
  if (c.req.method !== 'GET') return;

  const path = c.req.path;
  if (
    EXCLUDED_PATHS.has(path) ||
    path.startsWith('/doc/') ||
    path.startsWith('/admin') ||
    path.startsWith('/.well-known/')
  )
    return;

  const statusCode = c.res.status;
  const userAgent = c.req.header('user-agent') ?? null;
  const ip = getClientIp(c);
  const country = c.req.header('cf-ipcountry') ?? null;

  // Fire-and-forget: does not block or throw into the response chain
  enqueueAnalyticsEvent({
    path,
    method: c.req.method,
    statusCode,
    userAgent,
    ip,
    country,
    timestamp: Date.now(),
  });
}
