import { integer, pgTable, primaryKey } from 'drizzle-orm/pg-core';
import { experience } from './experience';
import { posts } from './posts';
import { projects } from './projects';
import { skills } from './skills';
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

export type PostTag = typeof postTags.$inferSelect;

// ── Skill pivot tables ──────────────────────────────────────────────────────

export const projectSkills = pgTable(
  'project_skills',
  {
    projectId: integer('project_id')
      .notNull()
      .references(() => projects.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.projectId, table.skillId] })]
);

export const experienceSkills = pgTable(
  'experience_skills',
  {
    experienceId: integer('experience_id')
      .notNull()
      .references(() => experience.id, { onDelete: 'cascade' }),
    skillId: integer('skill_id')
      .notNull()
      .references(() => skills.id, { onDelete: 'cascade' }),
  },
  (table) => [primaryKey({ columns: [table.experienceId, table.skillId] })]
);

export type ProjectSkill = typeof projectSkills.$inferSelect;
export type ExperienceSkill = typeof experienceSkills.$inferSelect;
