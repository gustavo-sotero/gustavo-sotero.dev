// Post/Project publication status
export const PostStatus = {
  DRAFT: 'draft',
  PUBLISHED: 'published',
  SCHEDULED: 'scheduled',
} as const;
export type PostStatus = (typeof PostStatus)[keyof typeof PostStatus];

// Comment moderation status
export const CommentStatus = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
} as const;
export type CommentStatus = (typeof CommentStatus)[keyof typeof CommentStatus];

// Comment author role
export const CommentAuthorRole = {
  GUEST: 'guest',
  ADMIN: 'admin',
} as const;
export type CommentAuthorRole = (typeof CommentAuthorRole)[keyof typeof CommentAuthorRole];

// Upload pipeline status
export const UploadStatus = {
  PENDING: 'pending',
  UPLOADED: 'uploaded',
  PROCESSED: 'processed',
  FAILED: 'failed',
} as const;
export type UploadStatus = (typeof UploadStatus)[keyof typeof UploadStatus];

// Tag categories for grouping skills
export const TagCategory = {
  LANGUAGE: 'language',
  FRAMEWORK: 'framework',
  TOOL: 'tool',
  DB: 'db',
  CLOUD: 'cloud',
  INFRA: 'infra',
  OTHER: 'other',
} as const;
export type TagCategory = (typeof TagCategory)[keyof typeof TagCategory];

// Transactional outbox event types — shared between API producers and worker relay.
// Both sides must use these constants so contract drift is caught at compile time.
export const OutboxEventType = {
  IMAGE_OPTIMIZE: 'image-optimize',
  SCHEDULED_POST_PUBLISH: 'scheduled-post-publish',
} as const;
export type OutboxEventType = (typeof OutboxEventType)[keyof typeof OutboxEventType];
