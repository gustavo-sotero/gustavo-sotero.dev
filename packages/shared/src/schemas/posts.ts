import { z } from 'zod';
import { coverUrlSchema } from '../lib/media-url';

/**
 * Validates a scheduledAt value: must be a valid ISO 8601 string in the future (UTC).
 * Returns a Date object on success.
 */
const futureISODate = z
  .string()
  .datetime({ offset: true, message: 'scheduledAt must be a valid ISO 8601 datetime string' })
  .refine((v) => new Date(v).getTime() > Date.now(), {
    message: 'scheduledAt must be a future date',
  })
  .transform((v) => new Date(v));

/**
 * Raw object shape — no cross-field refinements applied.
 * Used to derive both createPostSchema and updatePostSchema (via .partial()).
 * In Zod v4, .partial() cannot be called on a schema that already has .superRefine().
 */
const uniqueTagIds = z
  .array(z.number().int().positive())
  .refine((ids) => new Set(ids).size === ids.length, {
    message: 'tagIds cannot contain duplicates',
  });

const postSchemaBase = z.object({
  title: z.string().min(1).max(255),
  slug: z
    .string()
    .regex(/^[a-z0-9-]+$/, 'Slug must contain only lowercase letters, numbers, and hyphens')
    .optional(),
  content: z.string().min(1),
  excerpt: z.string().max(500).optional(),
  coverUrl: coverUrlSchema.optional(),
  status: z.enum(['draft', 'published', 'scheduled']).default('draft'),
  order: z.number().int().default(0),
  tagIds: uniqueTagIds.optional(),
  scheduledAt: futureISODate.optional(),
});

/** Shared cross-field refinement: status ↔ scheduledAt consistency. */
function refineScheduledStatus(
  data: { status?: string; scheduledAt?: unknown },
  ctx: z.RefinementCtx
): void {
  if (data.status === 'scheduled' && !data.scheduledAt) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scheduledAt'],
      message: "scheduledAt is required when status is 'scheduled'",
    });
  }
  if (data.status !== 'scheduled' && data.scheduledAt !== undefined) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['scheduledAt'],
      message: "scheduledAt must not be set unless status is 'scheduled'",
    });
  }
}

export const createPostSchema = postSchemaBase.superRefine(refineScheduledStatus);

// NOTE: postSchemaBase.partial() must be called on the raw base (no superRefine applied)
// because Zod v4 does not allow .partial() on refined schemas.
export const updatePostSchema = postSchemaBase.partial().superRefine(refineScheduledStatus);

export const postQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  perPage: z.coerce.number().int().positive().max(100).default(20),
  tag: z.string().optional(),
  status: z.enum(['draft', 'published', 'scheduled']).optional(),
  sort: z.enum(['manual', 'recent']).default('recent'),
});

// Schema-inferred input types (preferred over manual interface definitions)
export type CreatePostInput = z.infer<typeof createPostSchema>;
export type UpdatePostInput = z.infer<typeof updatePostSchema>;
export type PostQuery = z.infer<typeof postQuerySchema>;
export type PostSortMode = PostQuery['sort'];
