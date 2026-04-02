import { z } from 'zod';

/**
 * Shared Zod field definitions — single source of truth for validators, messages,
 * and defaults shared across multiple env parsers.
 *
 * This file is intentionally side-effect-free: it only exports schema fragments
 * and never calls `safeParse`, `parse`, or `process.exit`.
 *
 * Rules:
 *  - Import this from `env.database.ts`, `env.logger.ts`, and `env.ts` to compose schemas.
 *  - Never import from consumer modules (db.ts, logger.ts, app.ts) here — that would
 *    create circular dependencies.
 *  - When validation messages or defaults change, update them here only.
 */

/** Fields required solely for database access. */
export const databaseFields = {
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
};

/** Fields required solely for logger initialisation. */
export const loggerFields = {
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
};

/** Fields required by the full HTTP API runtime only. */
export const runtimeOnlyFields = {
  // Redis
  REDIS_URL: z.string().url('REDIS_URL must be a valid URL'),

  // JWT
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),

  // GitHub OAuth
  GITHUB_CLIENT_ID: z.string().min(1, 'GITHUB_CLIENT_ID is required'),
  GITHUB_CLIENT_SECRET: z.string().min(1, 'GITHUB_CLIENT_SECRET is required'),
  GITHUB_CALLBACK_URL: z.string().url('GITHUB_CALLBACK_URL must be a valid URL'),
  ADMIN_GITHUB_ID: z.string().min(1, 'ADMIN_GITHUB_ID is required'),

  // S3-compatible storage
  S3_ENDPOINT: z.string().url('S3_ENDPOINT must be a valid URL'),
  S3_BUCKET: z.string().min(1, 'S3_BUCKET is required'),
  S3_ACCESS_KEY: z.string().min(1, 'S3_ACCESS_KEY is required'),
  S3_SECRET_KEY: z.string().min(1, 'S3_SECRET_KEY is required'),
  S3_REGION: z.string().default('auto'),
  S3_PUBLIC_DOMAIN: z.string().min(1, 'S3_PUBLIC_DOMAIN is required'),

  // Telegram
  TELEGRAM_BOT_TOKEN: z.string().min(1, 'TELEGRAM_BOT_TOKEN is required'),
  TELEGRAM_CHAT_ID: z.string().min(1, 'TELEGRAM_CHAT_ID is required'),

  // Cloudflare Turnstile
  TURNSTILE_SECRET: z.string().min(1, 'TURNSTILE_SECRET is required'),

  // App
  ALLOWED_ORIGIN: z.string().url('ALLOWED_ORIGIN must be a valid URL'),
  API_PUBLIC_URL: z.string().url('API_PUBLIC_URL must be a valid URL'),
  PORT: z.coerce.number().default(3000),

  // Security
  IP_HASH_SALT: z.string().min(16, 'IP_HASH_SALT must be at least 16 characters'),
  BODY_SIZE_LIMIT: z.coerce.number().default(1_048_576),
  RATE_LIMIT_LOCAL_FALLBACK: z
    .enum(['true', 'false'])
    .default('true')
    .transform((value) => value === 'true'),

  // Admin profile
  ADMIN_DISPLAY_NAME: z.string().min(1).max(100).default('Admin'),
};

export const apiRuntimeFields = {
  ...databaseFields,
  ...runtimeOnlyFields,
  ...loggerFields,
};
