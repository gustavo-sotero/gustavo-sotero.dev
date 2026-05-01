import { z } from 'zod';

const optionalNonEmptyString = z.preprocess((value) => {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}, z.string().min(1).optional());

export const workerEnvSchema = z
  .object({
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
    AI_POSTS_ENABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    OPENROUTER_API_KEY: optionalNonEmptyString,
    AI_POSTS_TIMEOUT_MS: z.coerce.number().int().positive().default(30_000),
    // Outbox relay tuning
    OUTBOX_BATCH_SIZE: z.coerce.number().int().min(1).max(500).default(20),
    OUTBOX_POLL_INTERVAL_MS: z.coerce.number().int().min(500).max(60_000).default(5_000),
    // Telegram notification timeout
    TELEGRAM_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
  })
  .superRefine((data, ctx) => {
    if (data.AI_POSTS_ENABLED && !data.OPENROUTER_API_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['OPENROUTER_API_KEY'],
        message: 'OPENROUTER_API_KEY is required when AI_POSTS_ENABLED=true',
      });
    }
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
