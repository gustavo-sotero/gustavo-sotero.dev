import { sql } from 'drizzle-orm';
import {
  boolean,
  date,
  index,
  integer,
  pgTable,
  serial,
  text,
  timestamp,
  varchar,
} from 'drizzle-orm/pg-core';
import { statusEnum } from './enums';

export const experience = pgTable(
  'experience',
  {
    id: serial('id').primaryKey(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    role: varchar('role', { length: 255 }).notNull(),
    company: varchar('company', { length: 255 }).notNull(),
    description: text('description').notNull(),
    location: varchar('location', { length: 255 }),
    employmentType: varchar('employment_type', { length: 100 }),
    startDate: date('start_date').notNull(),
    endDate: date('end_date'),
    isCurrent: boolean('is_current').default(false).notNull(),
    order: integer('order').default(0).notNull(),
    status: statusEnum('status').default('draft').notNull(),
    logoUrl: varchar('logo_url', { length: 512 }),
    credentialUrl: varchar('credential_url', { length: 512 }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('experience_status_start_date_idx')
      .on(table.status, table.startDate)
      .where(sql`deleted_at IS NULL`),
    index('experience_deleted_at_idx').on(table.deletedAt).where(sql`deleted_at IS NULL`),
    index('experience_is_current_order_idx').on(table.isCurrent, table.order),
  ]
);

export type Experience = typeof experience.$inferSelect;
export type NewExperience = typeof experience.$inferInsert;
