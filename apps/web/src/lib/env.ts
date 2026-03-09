import { z } from 'zod';

const envSchema = z.object({
  NEXT_PUBLIC_API_URL: z.string().url(),
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: z.string().min(1),
  NEXT_PUBLIC_S3_PUBLIC_DOMAIN: z.string().min(1),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
  NEXT_PUBLIC_S3_PUBLIC_DOMAIN: process.env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN,
});

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  if (typeof process !== 'undefined' && process.exit) {
    process.exit(1);
  }

  throw new Error('Invalid environment variables');
}

export const env = parsed.data;
