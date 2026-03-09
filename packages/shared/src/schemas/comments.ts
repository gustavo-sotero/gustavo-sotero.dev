import { z } from 'zod';

export const createCommentSchema = z.object({
  postId: z.number().int().positive(),
  parentCommentId: z.string().uuid().optional(),
  authorName: z.string().min(2).max(100).trim(),
  authorEmail: z.string().email().max(255),
  content: z.string().min(3).max(2000).trim(),
  turnstileToken: z.string(),
});

export const adminReplyCommentSchema = z.object({
  postId: z.number().int().positive(),
  parentCommentId: z.string().uuid(),
  content: z.string().min(1).max(2000).trim(),
});

export const adminUpdateCommentStatusSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
  reason: z.string().max(500).trim().optional(),
});

export const adminUpdateCommentContentSchema = z.object({
  content: z.string().min(1).max(2000).trim(),
  reason: z.string().max(500).trim().optional(),
});

export const adminSoftDeleteCommentSchema = z.object({
  reason: z.string().max(500).trim().optional(),
});

export const adminCommentQuerySchema = z.object({
  page: z.coerce.number().int().positive().optional(),
  perPage: z.coerce.number().int().positive().max(100).optional(),
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  deleted: z.coerce.boolean().optional(),
  postId: z.coerce.number().int().positive().optional(),
});

// Schema-inferred input types
export type CreateCommentSchemaInput = z.infer<typeof createCommentSchema>;
export type AdminReplyCommentInput = z.infer<typeof adminReplyCommentSchema>;
export type AdminUpdateCommentStatusInput = z.infer<typeof adminUpdateCommentStatusSchema>;
export type AdminUpdateCommentContentInput = z.infer<typeof adminUpdateCommentContentSchema>;
export type AdminSoftDeleteCommentInput = z.infer<typeof adminSoftDeleteCommentSchema>;
export type AdminCommentQueryInput = z.infer<typeof adminCommentQuerySchema>;
