import { analyticsEvents } from '@portfolio/shared/db/schema';
import { and, count, desc, gte, like, lt, lte } from 'drizzle-orm';
import { db } from '../config/db';

export interface AnalyticsSummaryParams {
  from: Date;
  to: Date;
}

export interface TopPostsParams {
  from: Date;
  to: Date;
  limit?: number;
}

/** Insert a single analytics event. */
export async function createAnalyticsEvent(data: typeof analyticsEvents.$inferInsert) {
  const [row] = await db.insert(analyticsEvents).values(data).returning({ id: analyticsEvents.id });
  return row;
}

/** Batch insert analytics events. */
export async function createAnalyticsEvents(data: (typeof analyticsEvents.$inferInsert)[]) {
  if (data.length === 0) return;
  await db.insert(analyticsEvents).values(data);
}

/** Get total pageview count for a date range. */
export async function getPageviewCount(params: AnalyticsSummaryParams): Promise<number> {
  const conditions = [
    gte(analyticsEvents.createdAt, params.from),
    lte(analyticsEvents.createdAt, params.to),
  ];

  const [result] = await db
    .select({ total: count() })
    .from(analyticsEvents)
    .where(and(...conditions));

  return result?.total ?? 0;
}

/** Get top paths by view count for a date range. */
export async function getTopPaths(
  params: TopPostsParams
): Promise<{ path: string; views: number }[]> {
  const limit = Math.min(params.limit ?? 10, 100);
  const viewCount = count().as('views');

  const rows = await db
    .select({ path: analyticsEvents.path, views: viewCount })
    .from(analyticsEvents)
    .where(
      and(
        gte(analyticsEvents.createdAt, params.from),
        lte(analyticsEvents.createdAt, params.to),
        like(analyticsEvents.path, '/posts/%')
      )
    )
    .groupBy(analyticsEvents.path)
    .orderBy(desc(viewCount))
    .limit(limit);

  return rows.map((row) => ({ path: row.path, views: Number(row.views) }));
}

/** Delete analytics events older than a given date (retention job). */
export async function deleteOldAnalyticsEvents(olderThan: Date): Promise<number> {
  const deleted = await db
    .delete(analyticsEvents)
    .where(lt(analyticsEvents.createdAt, olderThan))
    .returning({ id: analyticsEvents.id });

  return deleted.length;
}
