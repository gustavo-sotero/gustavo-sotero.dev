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

export const education = pgTable(
  'education',
  {
    id: serial('id').primaryKey(),
    slug: varchar('slug', { length: 255 }).notNull().unique(),
    title: varchar('title', { length: 255 }).notNull(),
    institution: varchar('institution', { length: 255 }).notNull(),
    description: text('description'),
    location: varchar('location', { length: 255 }),
    educationType: varchar('education_type', { length: 100 }),
    startDate: date('start_date'),
    endDate: date('end_date'),
    isCurrent: boolean('is_current').default(false).notNull(),
    workloadHours: integer('workload_hours'),
    credentialId: varchar('credential_id', { length: 255 }),
    credentialUrl: varchar('credential_url', { length: 512 }),
    order: integer('order').default(0).notNull(),
    status: statusEnum('status').default('draft').notNull(),
    logoUrl: varchar('logo_url', { length: 512 }),
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index('education_status_start_date_idx')
      .on(table.status, table.startDate)
      .where(sql`deleted_at IS NULL`),
    index('education_deleted_at_idx').on(table.deletedAt).where(sql`deleted_at IS NULL`),
    index('education_is_current_order_idx').on(table.isCurrent, table.order),
  ]
);

export type Education = typeof education.$inferSelect;
export type NewEducation = typeof education.$inferInsert;
