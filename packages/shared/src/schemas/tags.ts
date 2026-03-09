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
  isHighlighted: z.boolean().optional().default(false),
});

/**
 * Update schema intentionally has no defaults — only fields explicitly sent
 * by the client should be passed to the service. Using createTagSchema.partial()
 * would inherit defaults and silently overwrite existing values on every PATCH.
 */
export const updateTagSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(tagCategoryValues).optional(),
  isHighlighted: z.boolean().optional(),
});

export const tagQuerySchema = z.object({
  category: tagCategoryCsvSchema.optional(), // comma-separated list of categories
});

// Schema-inferred input types
// CreateTagSchemaInput uses z.input<> so callers can omit fields that have
// defaults (e.g. isHighlighted, category) — defaults are applied by the schema.
export type CreateTagSchemaInput = z.input<typeof createTagSchema>;
export type UpdateTagSchemaInput = z.infer<typeof updateTagSchema>;
export type TagQuery = z.infer<typeof tagQuerySchema>;
