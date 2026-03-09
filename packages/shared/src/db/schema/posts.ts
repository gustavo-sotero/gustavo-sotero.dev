import { sql } from 'drizzle-orm';
import { index, pgTable, serial, text, timestamp, varchar } from 'drizzle-orm/pg-core';
import { statusEnum } from './enums';

export const posts = pgTable(
  'posts',
  {
    id: serial('id').primaryKey(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    excerpt: text('excerpt'),
    content: text('content'),
    renderedContent: text('rendered_content'),
    coverUrl: varchar('cover_url', { length: 512 }),
    status: statusEnum('status').default('draft').notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
  },
  (table) => [
    index('posts_status_published_at_idx')
      .on(table.status, table.publishedAt)
      .where(sql`deleted_at IS NULL`),
    index('posts_deleted_at_idx').on(table.deletedAt).where(sql`deleted_at IS NULL`),
    index('posts_status_scheduled_at_idx')
      .on(table.status, table.scheduledAt)
      .where(sql`deleted_at IS NULL`),
  ]
);

export type Post = typeof posts.$inferSelect;
export type NewPost = typeof posts.$inferInsert;
