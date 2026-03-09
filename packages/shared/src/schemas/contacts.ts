import { z } from 'zod';

export const createContactSchema = z.object({
  name: z.string().min(2).max(100).trim(),
  email: z.string().email().max(255),
  message: z.string().min(10).max(5000).trim(),
  turnstileToken: z.string(),
  website: z.string().max(0).optional(), // honeypot — must be empty
});

// Schema-inferred input type
export type CreateContactSchemaInput = z.infer<typeof createContactSchema>;
