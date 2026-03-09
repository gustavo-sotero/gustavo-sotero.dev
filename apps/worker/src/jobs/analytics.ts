/**
 * BullMQ job handler: analytics-events
 *
 * Processes an analytics event enqueued by the API analytics middleware:
 *  1. Hash the client IP with a salt (SHA-256) for privacy
 *  2. Insert the event into `analytics_events`
 *
 * The job is fire-and-forget on the API side — latency impact is zero.
 * Failures are retried via BullMQ's default queue settings.
 */

import { analyticsEvents } from '@portfolio/shared/db/schema';
import type { Job } from 'bullmq';
import { db } from '../config/db';
import { env } from '../config/env';
import { getLogger } from '../config/logger';

const logger = getLogger('jobs', 'analytics');

export interface AnalyticsEventPayload {
  path: string;
  method: string;
  statusCode: number;
  userAgent?: string | null;
  ip: string;
  country?: string | null;
  timestamp: number;
}

/** SHA-256 hash of a value using the Web Crypto API. */
async function sha256Hex(value: string): Promise<string> {
  const data = new TextEncoder().encode(value);
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function processAnalytics(job: Job<AnalyticsEventPayload>): Promise<void> {
  const { path, method, statusCode, userAgent, ip, country, timestamp } = job.data;

  // Hash IP address with salt for privacy-preserving storage
  const ipHash = await sha256Hex(ip + env.IP_HASH_SALT);

  await db.insert(analyticsEvents).values({
    path,
    method,
    statusCode: statusCode as number,
    ipHash,
    country: country ?? null,
    userAgent: userAgent ?? null,
    createdAt: new Date(timestamp),
  });

  logger.debug('Analytics event persisted', { path, method, statusCode });
}
