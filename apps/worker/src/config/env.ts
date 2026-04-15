import { z } from 'zod';

const workerEnvSchema = z.object({
  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),
  S3_ENDPOINT: z.string().url(),
  S3_BUCKET: z.string().min(1),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_REGION: z.string().default('auto'),
  S3_PUBLIC_DOMAIN: z.string().min(1),
  TELEGRAM_BOT_TOKEN: z.string().min(1),
  TELEGRAM_CHAT_ID: z.string().min(1),
  IP_HASH_SALT: z.string().min(16),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  // AI post generation (optional — worker skips AI jobs if absent)
  OPENROUTER_API_KEY: z.string().min(1).optional(),
  AI_POSTS_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
});

const parsed = workerEnvSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid worker environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
