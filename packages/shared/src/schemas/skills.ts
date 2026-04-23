import { z } from 'zod';

export const skillCategoryValues = [
  'language',
  'framework',
  'tool',
  'db',
  'cloud',
  'infra',
] as const;

export const expertiseLevelSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);

export const createSkillSchema = z.object({
  name: z.string().min(1).max(100),
  category: z.enum(skillCategoryValues),
  expertiseLevel: expertiseLevelSchema.default(1),
  isHighlighted: z.boolean().optional().default(false),
});

/**
 * Update schema intentionally has no defaults — only fields explicitly sent
 * by the client should be passed to the service.
 */
export const updateSkillSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  category: z.enum(skillCategoryValues).optional(),
  expertiseLevel: expertiseLevelSchema.optional(),
  isHighlighted: z.boolean().optional(),
});

export const skillQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(100),
  category: z.string().optional(),
  highlighted: z.preprocess(
    (v) => (v === 'true' ? true : v === 'false' ? false : v),
    z.boolean().optional()
  ),
});

export type CreateSkillSchemaInput = z.input<typeof createSkillSchema>;
export type UpdateSkillSchemaInput = z.infer<typeof updateSkillSchema>;
export type SkillQuery = z.infer<typeof skillQuerySchema>;
