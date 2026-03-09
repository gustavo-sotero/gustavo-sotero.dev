import 'server-only';
import { z } from 'zod';

const serverEnvSchema = z.object({
  REVALIDATE_SECRET: z.string().min(16, 'REVALIDATE_SECRET must be at least 16 characters'),
  API_INTERNAL_URL: z.string().url().optional(),
});

const parsed = serverEnvSchema.safeParse({
  REVALIDATE_SECRET: process.env.REVALIDATE_SECRET,
  API_INTERNAL_URL: process.env.API_INTERNAL_URL,
});

if (!parsed.success) {
  console.error('❌ Invalid server environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid server environment variables');
}

export const serverEnv = parsed.data;
