import { sql } from 'drizzle-orm';
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { statusEnum } from './enums';

export const projects = pgTable(
  'projects',
  {
    id: serial('id').primaryKey(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    description: text('description'),
    content: text('content'),
    renderedContent: text('rendered_content'),
    coverUrl: varchar('cover_url', { length: 512 }),
    status: statusEnum('status').default('draft').notNull(),
    repositoryUrl: varchar('repository_url', { length: 512 }),
    liveUrl: varchar('live_url', { length: 512 }),
    featured: boolean('featured').default(false).notNull(),
    order: integer('order').default(0).notNull(),
    impactFacts: jsonb('impact_facts').$type<string[]>().default([]).notNull(),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('projects_deleted_at_idx').on(table.deletedAt).where(sql`deleted_at IS NULL`),
    index('projects_status_idx').on(table.status),
    index('projects_featured_idx').on(table.featured),
  ]
);

export type Project = typeof projects.$inferSelect;
export type NewProject = typeof projects.$inferInsert;
