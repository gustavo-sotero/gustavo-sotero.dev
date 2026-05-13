import 'server-only';
import { z } from 'zod';
import { resolveServerEnvInput } from './build-env-defaults';

const serverEnvSchema = z.object({
  REVALIDATE_SECRET: z.string().min(16, 'REVALIDATE_SECRET must be at least 16 characters'),
  API_INTERNAL_URL: z.string().url().optional(),
});

const { env } = resolveServerEnvInput(process.env);

const parsed = serverEnvSchema.safeParse(env);

if (!parsed.success) {
  console.error('❌ Invalid server environment variables:', parsed.error.flatten().fieldErrors);
  throw new Error('Invalid server environment variables');
}

export const serverEnv = parsed.data;
