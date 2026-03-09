import { bigserial, index, pgTable, smallint, text, timestamp, varchar } from 'drizzle-orm/pg-core';

export const analyticsEvents = pgTable(
  'analytics_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    path: varchar('path', { length: 512 }).notNull(),
    method: varchar('method', { length: 10 }),
    statusCode: smallint('status_code'),
    ipHash: varchar('ip_hash', { length: 64 }),
    country: varchar('country', { length: 2 }),
    userAgent: text('user_agent'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [
    index('analytics_path_created_at_idx').on(table.path, table.createdAt),
    index('analytics_created_at_idx').on(table.createdAt),
  ]
);

export type AnalyticsEvent = typeof analyticsEvents.$inferSelect;
export type NewAnalyticsEvent = typeof analyticsEvents.$inferInsert;
