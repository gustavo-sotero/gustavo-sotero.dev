import { pgEnum } from 'drizzle-orm/pg-core';

export const statusEnum = pgEnum('status', ['draft', 'published', 'scheduled']);

export const commentStatusEnum = pgEnum('comment_status', ['pending', 'approved', 'rejected']);

export const commentAuthorRoleEnum = pgEnum('comment_author_role', ['guest', 'admin']);

export const uploadStatusEnum = pgEnum('upload_status', [
  'pending',
  'uploaded',
  'processed',
  'failed',
]);

export const tagCategoryEnum = pgEnum('tag_category', [
  'language',
  'framework',
  'tool',
  'db',
  'cloud',
  'infra',
  'other',
]);
