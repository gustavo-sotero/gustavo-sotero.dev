import { z } from 'zod';

const tagCategoryValues = [
  'language',
  'framework',
  'tool',
  'db',
  'cloud',
  'infra',
  'other',
] as const;

const tagCategoryCsvSchema = z.string().refine(
  (value) => {
    const categories = value
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    if (categories.length === 0) {
      return false;
    }

    return categories.every((category) =>
      (tagCategoryValues as readonly string[]).includes(category)
    );
  },
  {
    message:
      'Invalid category list. Use comma-separated values: language, framework, tool, db, cloud, infra, other',
  }
);

export const createTagSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(tagCategoryValues).default('other'),
});

/**
 * Update schema intentionally has no defaults — only fields explicitly sent
 * by the client should be passed to the service. Using createTagSchema.partial()
 * would inherit defaults and silently overwrite existing values on every PATCH.
 */
export const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(tagCategoryValues).optional(),
});

export const tagQuerySchema = z.object({
  category: tagCategoryCsvSchema.optional(), // comma-separated list of categories
});

export const tagSourceValues = ['post'] as const;
export type TagSource = (typeof tagSourceValues)[number];

/**
 * Public query schema for GET /tags.
 *
 * Tags are post-only taxonomy. The `source` filter is kept for backward
 * compatibility but only accepts `post` — project and experience no longer
 * expose tags.
 */
export const publicTagQuerySchema = tagQuerySchema.extend({
  source: z.enum(tagSourceValues).optional(),
});

// Schema-inferred input types
// CreateTagSchemaInput uses z.input<> so callers can omit fields that have
// defaults (e.g. category) — defaults are applied by the schema.
export type CreateTagSchemaInput = z.input<typeof createTagSchema>;
export type UpdateTagSchemaInput = z.infer<typeof updateTagSchema>;
export type TagQuery = z.infer<typeof tagQuerySchema>;
export type PublicTagQuery = z.infer<typeof publicTagQuerySchema>;

/**
 * Body schema for `POST /admin/tags/resolve-ai-suggested`.
 * Accepts a list of raw AI-suggested tag names; the backend canonicalizes,
 * deduplicates, resolves existing tags, and creates any missing ones.
 */
export const resolveAiTagsSchema = z.object({
  names: z.array(z.string().min(1).max(100)).min(1).max(50),
});
export type ResolveAiTagsInput = z.infer<typeof resolveAiTagsSchema>;
