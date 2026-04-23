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

export const tagSourceValues = ['project', 'post', 'experience'] as const;
export type TagSource = (typeof tagSourceValues)[number];

/**
 * Public query schema for GET /tags.
 *
 * Extends `tagQuerySchema` with an optional `source` filter that restricts
 * results to tags associated with a specific entity origin:
 * - `project`: only tags linked to published, non-deleted projects
 * - `post`: only tags linked to published, non-deleted posts
 * - `experience`: only tags linked to published, non-deleted experience entries
 *
 * When `source` is omitted the route returns the union of all origins
 * (legacy/default behavior) for backward compatibility.
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
