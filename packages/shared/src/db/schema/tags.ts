import { boolean, pgTable, serial, timestamp, varchar } from 'drizzle-orm/pg-core';
import { tagCategoryEnum } from './enums';

export const tags = pgTable('tags', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 100 }).notNull().unique(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  category: tagCategoryEnum('category').default('other').notNull(),
  iconKey: varchar('icon_key', { length: 100 }),
  isHighlighted: boolean('is_highlighted').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

export type Tag = typeof tags.$inferSelect;
export type NewTag = typeof tags.$inferInsert;
