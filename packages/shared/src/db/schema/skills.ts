import { sql } from 'drizzle-orm';
import { check, index, pgTable, serial, smallint, timestamp, varchar } from 'drizzle-orm/pg-core';
import { skillCategoryEnum } from './enums';

export const skills = pgTable(
  'skills',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull().unique(),
    slug: varchar('slug', { length: 100 }).notNull().unique(),
    category: skillCategoryEnum('category').notNull(),
    iconKey: varchar('icon_key', { length: 100 }),
    expertiseLevel: smallint('expertise_level').notNull().default(1),
    isHighlighted: smallint('is_highlighted').notNull().default(0),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    check(
      'skills_expertise_level_check',
      sql`${table.expertiseLevel} >= 1 AND ${table.expertiseLevel} <= 3`
    ),
    check('skills_is_highlighted_check', sql`${table.isHighlighted} IN (0, 1)`),
    index('skills_category_idx').on(table.category),
    index('skills_is_highlighted_idx').on(table.isHighlighted),
  ]
);

export type Skill = typeof skills.$inferSelect;
export type NewSkill = typeof skills.$inferInsert;
