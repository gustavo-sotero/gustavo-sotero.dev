import { pgTable, timestamp, varchar } from 'drizzle-orm/pg-core';

/**
 * Singleton configuration row for the AI post generation feature.
 *
 * Uses a `scope` primary key fixed to 'global' so there is always at most one
 * row. Stores only the active model IDs — the catalog metadata stays external
 * (fetched from OpenRouter on demand) and is never persisted here.
 */
export const aiPostGenerationSettings = pgTable('ai_post_generation_settings', {
  scope: varchar('scope', { length: 32 }).primaryKey().default('global'),
  topicsModelId: varchar('topics_model_id', { length: 255 }),
  draftModelId: varchar('draft_model_id', { length: 255 }),
  updatedBy: varchar('updated_by', { length: 255 }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type AiPostGenerationSettings = typeof aiPostGenerationSettings.$inferSelect;
export type NewAiPostGenerationSettings = typeof aiPostGenerationSettings.$inferInsert;
