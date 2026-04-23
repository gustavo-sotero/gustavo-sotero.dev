import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date in YYYY-MM-DD format');

const uniqueTagIds = z
  .array(z.number().int().positive())
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'tagIds cannot contain duplicates',
  });

const uniqueSkillIds = z
  .array(z.number().int().positive())
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'skillIds cannot contain duplicates',
  });

/**
 * Ordered list of concise impact facts for an experience entry.
 * Each fact must be a non-empty string up to 200 characters.
 * Maximum of 6 facts per experience entry.
 */
export const experienceImpactFactsSchema = z
  .array(
    z
      .string()
      .trim()
      .min(1, 'Impact fact cannot be empty')
      .max(200, 'Each impact fact must be 200 characters or fewer')
  )
  .max(6, 'Maximum 6 impact facts allowed')
  .optional();

// Base object shape extracted so .partial() can be called without hitting Zod v4's
// restriction that .partial() cannot be used on schemas containing refinements.
const experienceBaseShape = z.object({
  role: z.string().min(1).max(255),
  company: z.string().min(1).max(255),
  description: z.string().min(1),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  location: z.string().max(255).optional(),
  employmentType: z.string().max(100).optional(),
  startDate: dateString,
  endDate: dateString.optional(),
  isCurrent: z.boolean().default(false),
  order: z.number().int().min(0).default(0),
  status: z.enum(['draft', 'published']).default('draft'),
  logoUrl: z.union([z.literal(''), z.string().url()]).optional(),
  credentialUrl: z.union([z.literal(''), z.string().url()]).optional(),
  impactFacts: experienceImpactFactsSchema,
  tagIds: uniqueTagIds.optional(),
  skillIds: uniqueSkillIds.optional(),
});

export const createExperienceSchema = experienceBaseShape
  .refine(
    (data) => {
      if (data.endDate && data.startDate && data.endDate < data.startDate) {
        return false;
      }
      return true;
    },
    { message: 'endDate must be on or after startDate', path: ['endDate'] }
  )
  .refine(
    (data) => {
      if (!data.isCurrent && !data.endDate) {
        return false;
      }
      return true;
    },
    { message: 'endDate is required when isCurrent is false', path: ['endDate'] }
  );

// Partial updates do not need cross-field date refinements (service layer validates).
export const updateExperienceSchema = experienceBaseShape.partial();

export const experienceQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['draft', 'published']).optional(),
});

export const adminExperienceQuerySchema = experienceQuerySchema;

export type CreateExperienceInput = z.infer<typeof createExperienceSchema>;
export type UpdateExperienceInput = z.infer<typeof updateExperienceSchema>;
export type ExperienceQuery = z.infer<typeof experienceQuerySchema>;
