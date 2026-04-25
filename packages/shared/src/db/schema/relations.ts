import { relations } from 'drizzle-orm';
import { comments } from './comments';
import { experience } from './experience';
import { experienceSkills, postTags, projectSkills } from './pivots';
import { posts } from './posts';
import { projects } from './projects';
import { skills } from './skills';
import { tags } from './tags';

export const postsRelations = relations(posts, ({ many }) => ({
  tags: many(postTags),
  comments: many(comments),
}));

export const postTagsRelations = relations(postTags, ({ one }) => ({
  post: one(posts, {
    fields: [postTags.postId],
    references: [posts.id],
  }),
  tag: one(tags, {
    fields: [postTags.tagId],
    references: [tags.id],
  }),
}));

export const projectsRelations = relations(projects, ({ many }) => ({
  skills: many(projectSkills),
}));

export const tagsRelations = relations(tags, ({ many }) => ({
  postTags: many(postTags),
}));

export const commentsRelations = relations(comments, ({ one, many }) => ({
  post: one(posts, {
    fields: [comments.postId],
    references: [posts.id],
  }),
  parent: one(comments, {
    fields: [comments.parentCommentId],
    references: [comments.id],
    relationName: 'comment_replies',
  }),
  children: many(comments, {
    relationName: 'comment_replies',
  }),
}));

export const experienceRelations = relations(experience, ({ many }) => ({
  skills: many(experienceSkills),
}));

// ── Skill relations ───────────────────────────────────────────────────────────

export const skillsRelations = relations(skills, ({ many }) => ({
  projectSkills: many(projectSkills),
  experienceSkills: many(experienceSkills),
}));

export const projectSkillsRelations = relations(projectSkills, ({ one }) => ({
  project: one(projects, {
    fields: [projectSkills.projectId],
    references: [projects.id],
  }),
  skill: one(skills, {
    fields: [projectSkills.skillId],
    references: [skills.id],
  }),
}));

export const experienceSkillsRelations = relations(experienceSkills, ({ one }) => ({
  experience: one(experience, {
    fields: [experienceSkills.experienceId],
    references: [experience.id],
  }),
  skill: one(skills, {
    fields: [experienceSkills.skillId],
    references: [skills.id],
  }),
}));
