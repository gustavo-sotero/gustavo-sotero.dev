/**
 * Service layer for admin analytics.
 *
 * Encapsulates aggregation logic, caching strategy, and data access for the
 * analytics dashboard. The admin/analytics route delegates all data retrieval
 * and composition to this module, staying responsible only for parameter
 * parsing, validation, and response serialisation.
 */

import { comments, posts, projects } from '@portfolio/shared/db/schema';
import { and, count as drizzleCount, eq, isNull } from 'drizzle-orm';
import { db } from '../config/db';
import { cached } from '../lib/cache';
import { getPageviewCount, getTopPaths } from '../repositories/analytics.repo';

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Normalize a Date to a YYYY-MM-DD string for stable cache keys.
 * Millisecond-precision ISO strings would produce near-cache-misses for every
 * request even with the same logical date window.
 */
export function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

// ── Types ─────────────────────────────────────────────────────────────────────

export interface AnalyticsSummary {
  pageviews: number;
  pendingComments: number;
  publishedPosts: number;
  publishedProjects: number;
  from: string;
  to: string;
}

// ── Service methods ───────────────────────────────────────────────────────────

/**
 * Returns aggregated analytics summary for a date range.
 * Result is cached for 5 minutes keyed by normalised date boundaries.
 */
export async function getAnalyticsSummary({
  from,
  to,
}: {
  from: Date;
  to: Date;
}): Promise<AnalyticsSummary> {
  const cacheKey = `analytics:summary:${toDateKey(from)}:${toDateKey(to)}`;

  return cached(cacheKey, 300, async () => {
    const [pageviews, publishedPosts, publishedProjects, pendingCommentsResult] = await Promise.all(
      [
        getPageviewCount({ from, to }),
        db
          .select({ total: drizzleCount() })
          .from(posts)
          // Exclude soft-deleted posts so the dashboard reflects the actual
          // lifecycle state of content (matches what public visitors see).
          .where(and(eq(posts.status, 'published'), isNull(posts.deletedAt)))
          .then(([r]) => r?.total ?? 0),
        db
          .select({ total: drizzleCount() })
          .from(projects)
          .where(and(eq(projects.status, 'published'), isNull(projects.deletedAt)))
          .then(([r]) => r?.total ?? 0),
        db
          .select({ total: drizzleCount() })
          .from(comments)
          .where(eq(comments.status, 'pending'))
          .then(([r]) => r?.total ?? 0),
      ]
    );

    return {
      pageviews,
      pendingComments: pendingCommentsResult,
      publishedPosts,
      publishedProjects,
      from: from.toISOString(),
      to: to.toISOString(),
    };
  });
}

/**
 * Returns top paths by view count for a date range.
 * Result is cached for 5 minutes keyed by normalised date boundaries and limit.
 */
export async function getAnalyticsTopPosts({
  from,
  to,
  limit,
}: {
  from: Date;
  to: Date;
  limit: number;
}): Promise<{ path: string; views: number }[]> {
  const cacheKey = `analytics:top-posts:${toDateKey(from)}:${toDateKey(to)}:${limit}`;
  return cached(cacheKey, 300, async () => getTopPaths({ from, to, limit }));
}
