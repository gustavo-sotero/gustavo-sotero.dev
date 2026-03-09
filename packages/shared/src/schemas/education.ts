import { z } from 'zod';

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be a valid date in YYYY-MM-DD format');

// Base object shape extracted so .partial() can be called without hitting Zod v4's
// restriction that .partial() cannot be used on schemas containing refinements.
const educationBaseShape = z.object({
  title: z.string().min(1).max(255),
  institution: z.string().min(1).max(255),
  description: z.string().optional(),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  location: z.string().max(255).optional(),
  educationType: z.string().max(100).optional(),
  startDate: dateString.optional(),
  endDate: dateString.optional(),
  isCurrent: z.boolean().default(false),
  workloadHours: z.number().int().positive().optional(),
  credentialId: z.string().max(255).optional(),
  credentialUrl: z.union([z.literal(''), z.string().url()]).optional(),
  order: z.number().int().min(0).default(0),
  status: z.enum(['draft', 'published']).default('draft'),
  logoUrl: z.union([z.literal(''), z.string().url()]).optional(),
});

export const createEducationSchema = educationBaseShape.refine(
  (data) => {
    if (data.endDate && data.startDate && data.endDate < data.startDate) {
      return false;
    }
    return true;
  },
  { message: 'endDate must be on or after startDate', path: ['endDate'] }
);

// Partial updates do not need cross-field date refinements (service layer validates).
export const updateEducationSchema = educationBaseShape.partial();

export const educationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  status: z.enum(['draft', 'published']).optional(),
});

export const adminEducationQuerySchema = educationQuerySchema;

export type CreateEducationInput = z.infer<typeof createEducationSchema>;
export type UpdateEducationInput = z.infer<typeof updateEducationSchema>;
export type EducationQuery = z.infer<typeof educationQuerySchema>;
