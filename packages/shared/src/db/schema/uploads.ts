import { index, integer, jsonb, pgTable, timestamp, uuid, varchar } from 'drizzle-orm/pg-core';
import { uploadStatusEnum } from './enums';

export const uploads = pgTable(
  'uploads',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    storageKey: varchar('storage_key', { length: 512 }).notNull(),
    originalUrl: varchar('original_url', { length: 512 }).notNull(),
    optimizedUrl: varchar('optimized_url', { length: 512 }),
    variants: jsonb('variants').$type<{ thumbnail?: string; medium?: string }>(),
    mime: varchar('mime', { length: 50 }).notNull(),
    size: integer('size').notNull(),
    width: integer('width'),
    height: integer('height'),
    status: uploadStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [index('uploads_status_idx').on(table.status)]
);

export type Upload = typeof uploads.$inferSelect;
export type NewUpload = typeof uploads.$inferInsert;
