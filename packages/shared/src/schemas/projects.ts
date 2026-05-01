import { z } from 'zod';
import { coverUrlSchema } from '../lib/media-url';

const uniqueSkillIds = z
  .array(z.number().int().positive())
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'skillIds cannot contain duplicates',
  });

/**
 * Ordered list of concise impact facts for a project.
 * Each fact must be a non-empty string up to 200 characters.
 * Maximum of 6 facts per project.
 */
export const projectImpactFactsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'Impact fact cannot be empty')
      .max(200, 'Each impact fact must be 200 characters or fewer')
  )
  .max(6, 'Maximum 6 impact facts allowed')
  .optional();

const projectBaseShape = z
  .object({
    title: z.string().min(1).max(255),
    slug: z
      .string()
      .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
      .optional(),
    description: z.string().max(500).optional(),
    content: z.string().optional(),
    coverUrl: coverUrlSchema.optional(),
    status: z.enum(['draft', 'published']).default('draft'),
    repositoryUrl: z.union([z.literal(''), z.string().url()]).optional(),
    liveUrl: z.union([z.literal(''), z.string().url()]).optional(),
    featured: z.boolean().default(false),
    order: z.number().int().default(0),
    impactFacts: projectImpactFactsSchema,
    skillIds: uniqueSkillIds.optional(),
  })
  .strict();

export const createProjectSchema = projectBaseShape;

export const updateProjectSchema = projectBaseShape.partial();

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
  skill: z.string().optional(),
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
