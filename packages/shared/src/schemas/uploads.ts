import { z } from 'zod';
import { MAX_UPLOAD_BYTES } from '../constants/uploads';

export const presignRequestSchema = z.object({
  mime: z.enum(['image/jpeg', 'image/png', 'image/webp', 'image/gif']),
  size: z.number().int().positive().max(MAX_UPLOAD_BYTES, 'File size must not exceed 5MB'),
  filename: z.string().min(1).max(255),
});

// Schema-inferred type
export type PresignRequestInput = z.infer<typeof presignRequestSchema>;
