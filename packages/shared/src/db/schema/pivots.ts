import { integer, pgTable, primaryKey } from 'drizzle-orm/pg-core';
import { experience } from './experience';
import { posts } from './posts';
import { projects } from './projects';
import { tags } from './tags';

export const postTags = pgTable(
  'post_tags',
  {
    postId: integer('post_id')
      .notNull()
      .references(() => posts.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.postId, table.tagId] })]
);

export const projectTags = pgTable(
  'project_tags',
  {
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.tagId] })]
);

export const experienceTags = pgTable(
  'experience_tags',
  {
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experience.id, { onDelete: 'cascade' }),
    tagId: integer('tag_id')
      .notNull()
      .references(() => tags.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.experienceId, table.tagId] })]
);

export type PostTag = typeof postTags.$inferSelect;
export type ProjectTag = typeof projectTags.$inferSelect;
export type ExperienceTag = typeof experienceTags.$inferSelect;
