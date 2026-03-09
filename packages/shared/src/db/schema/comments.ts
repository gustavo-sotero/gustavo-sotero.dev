import {
  type AnyPgColumn,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from 'drizzle-orm/pg-core';
import { commentAuthorRoleEnum, commentStatusEnum } from './enums';
import { posts } from './posts';

export const comments = pgTable(
  'comments',
  {
    id: uuid('id').defaultRandom().primaryKey(),
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    // Self-referencing FK for threaded replies (NULL = root comment)
    parentCommentId: uuid('parent_comment_id').references((): AnyPgColumn => comments.id, {
      onDelete: 'set null',
    }),
    authorName: varchar('author_name', { length: 100 }).notNull(),
    authorEmail: varchar('author_email', { length: 255 }).notNull(),
    authorRole: commentAuthorRoleEnum('author_role').default('guest').notNull(),
    content: text('content').notNull(),
    renderedContent: text('rendered_content').notNull(),
    status: commentStatusEnum('status').default('pending').notNull(),
    ipHash: varchar('ip_hash', { length: 64 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    moderatedAt: timestamp('moderated_at', { withTimezone: true }),
    moderatedBy: varchar('moderated_by', { length: 100 }),
    // Admin edit audit
    editedAt: timestamp('edited_at', { withTimezone: true }),
    editedBy: varchar('edited_by', { length: 100 }),
    editReason: text('edit_reason'),
    // Soft delete
    deletedAt: timestamp('deleted_at', { withTimezone: true }),
    deletedBy: varchar('deleted_by', { length: 100 }),
    deleteReason: text('delete_reason'),
  },
  (table) => [
    index('comments_post_id_parent_created_at_idx').on(
      table.postId,
      table.parentCommentId,
      table.createdAt
    ),
    index('comments_parent_comment_id_created_at_idx').on(table.parentCommentId, table.createdAt),
    index('comments_status_created_at_idx').on(table.status, table.createdAt),
    index('comments_deleted_at_idx').on(table.deletedAt),
  ]
);

export type Comment = typeof comments.$inferSelect;
export type NewComment = typeof comments.$inferInsert;
