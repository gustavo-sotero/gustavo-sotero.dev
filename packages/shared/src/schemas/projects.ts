import { z } from 'zod';

const uniqueTagIds = z
  .array(z.number().int().positive())
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'tagIds cannot contain duplicates',
  });

export const createProjectSchema = z.object({
  title: z.string().min(1).max(255),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  description: z.string().max(500).optional(),
  content: z.string().optional(),
  coverUrl: z.union([z.literal(''), z.string().url()]).optional(),
  status: z.enum(['draft', 'published']).default('draft'),
  repositoryUrl: z.union([z.literal(''), z.string().url()]).optional(),
  liveUrl: z.union([z.literal(''), z.string().url()]).optional(),
  featured: z.boolean().default(false),
  order: z.number().int().default(0),
  tagIds: uniqueTagIds.optional(),
});

export const updateProjectSchema = createProjectSchema.partial();

/**
 * Query-string boolean: coerces the strings "true"/"false" correctly.
 * `z.coerce.boolean()` converts ANY non-empty string to `true` (Boolean('false') === true).
 */
const queryBool = z.preprocess(
  (v) => (v === 'true' ? true : v === 'false' ? false : v),
  z.boolean().optional()
);

export const projectQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  tag: z.string().optional(),
  featured: queryBool,
  featuredFirst: queryBool,
});

export const adminProjectQuerySchema = projectQuerySchema.extend({
  status: z.enum(['draft', 'published']).optional(),
});

// Schema-inferred input types
export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectQuery = z.infer<typeof projectQuerySchema>;
export type AdminProjectQuery = z.infer<typeof adminProjectQuerySchema>;
