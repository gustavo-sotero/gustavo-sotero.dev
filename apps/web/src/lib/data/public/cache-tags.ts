/**
 * Canonical cache tag taxonomy for public Next.js cache entries.
 *
 * Taxonomy rules:
 *  - Prefix `public:` on all public tags to isolate from admin cache future uses.
 *  - Aggregate tags (lists, home) are invalidated on any mutation of that entity type.
 *  - Detail tags are invalidated when a specific slug changes.
 *  - Entity tags are for future fine-grained invalidation by database ID.
 */

// ─── Aggregate tags ───────────────────────────────────────────────────────────
export const TAG_HOME = 'public:home';
export const TAG_POSTS_LIST = 'public:posts:list';
export const TAG_PROJECTS_LIST = 'public:projects:list';
export const TAG_SKILLS_LIST = 'public:skills:list';
export const TAG_TAGS_LIST = 'public:tags:list';
export const TAG_EXPERIENCE_LIST = 'public:experience:list';
export const TAG_EDUCATION_LIST = 'public:education:list';

// ─── Detail tag builders ──────────────────────────────────────────────────────
export const tagPostDetail = (slug: string) => `public:posts:detail:${slug}` as const;
export const tagProjectDetail = (slug: string) => `public:projects:detail:${slug}` as const;

// ─── Entity tag builders (for future fine-grained invalidation) ───────────────
export const tagPostEntity = (id: number) => `public:posts:entity:${id}` as const;
export const tagProjectEntity = (id: number) => `public:projects:entity:${id}` as const;
export const tagTagEntity = (id: number) => `public:tags:entity:${id}` as const;

function uniqueTags(tags: Array<string | undefined>): string[] {
  return Array.from(new Set(tags.filter((tag): tag is string => Boolean(tag))));
}

// ─── Mutation → tags mapping (used in revalidation helper + admin hooks) ──────
/**
 * Tags to revalidate when a post is created, updated, or deleted.
 * Pass `slug` to also invalidate the specific detail cache.
 */
export function postMutationTags(slug?: string): string[] {
  return uniqueTags([TAG_HOME, TAG_POSTS_LIST, slug ? tagPostDetail(slug) : undefined]);
}

/**
 * Tags to revalidate when a post slug may have changed.
 * Invalidates both previous and current detail cache keys.
 */
export function postMutationTagsWithSlugTransition(
  previousSlug?: string,
  currentSlug?: string
): string[] {
  return uniqueTags([
    TAG_HOME,
    TAG_POSTS_LIST,
    previousSlug ? tagPostDetail(previousSlug) : undefined,
    currentSlug ? tagPostDetail(currentSlug) : undefined,
  ]);
}

/**
 * Tags to revalidate when a project is created, updated, or deleted.
 * Pass `slug` to also invalidate the specific detail cache.
 */
export function projectMutationTags(slug?: string): string[] {
  return uniqueTags([TAG_HOME, TAG_PROJECTS_LIST, slug ? tagProjectDetail(slug) : undefined]);
}

/**
 * Tags to revalidate when a project slug may have changed.
 * Invalidates both previous and current detail cache keys.
 */
export function projectMutationTagsWithSlugTransition(
  previousSlug?: string,
  currentSlug?: string
): string[] {
  return uniqueTags([
    TAG_HOME,
    TAG_PROJECTS_LIST,
    previousSlug ? tagProjectDetail(previousSlug) : undefined,
    currentSlug ? tagProjectDetail(currentSlug) : undefined,
  ]);
}

/**
 * Tags to revalidate when a tag entity is created, updated, or deleted.
 */
export function tagMutationTags(): string[] {
  return [TAG_HOME, TAG_TAGS_LIST, TAG_POSTS_LIST, TAG_PROJECTS_LIST];
}

/**
 * Tags to revalidate when an experience entry is created, updated, or deleted.
 */
export function experienceMutationTags(): string[] {
  return [TAG_EXPERIENCE_LIST, TAG_TAGS_LIST];
}

/**
 * Tags to revalidate when an education entry is created, updated, or deleted.
 */
export function educationMutationTags(): string[] {
  return [TAG_EDUCATION_LIST];
}

/**
 * Tags to revalidate when a skill is created, updated, or deleted.
 */
export function skillMutationTags(): string[] {
  return [TAG_HOME, TAG_SKILLS_LIST];
}
