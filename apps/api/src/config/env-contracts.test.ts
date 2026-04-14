/**
 * Env contract regression tests.
 *
 * These tests verify that the env-boundary split is implemented correctly:
 *  - `databaseFields` schema succeeds with only DATABASE_URL.
 *  - `loggerFields` schema succeeds with no explicit NODE_ENV and defaults predictably.
 *  - The strict API runtime parser still fails when required runtime vars are absent.
 *  - The migration module can be imported in a minimal-env context without requiring
 *    Redis, OAuth, S3, Telegram, or any other runtime secret.
 *
 * Isolation strategy:
 *  Schema tests (databaseEnv, loggerEnv, strict runtime) use Zod safeParse directly
 *  against the field definitions in env.fields.ts. No module resets or env mutations
 *  are required because the schemas accept explicit inputs rather than reading
 *  process.env at test time.
 *
 *  The migrate isolation test is the one case that requires a real import. It places
 *  a real import under a minimal env surface and then closes the lazily-created
 *  postgres client. This avoids relying on Vitest module-reset/mocking helpers,
 *  which are not consistently available across all runners used in this repo.
 */

import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import { apiRuntimeFields, databaseFields, loggerFields } from './env.fields';

// ── Helpers ───────────────────────────────────────────────────────────────────

function captureEnv(keys: string[]): Record<string, string | undefined> {
  return Object.fromEntries(keys.map((k) => [k, process.env[k]]));
}

function restoreEnv(snapshot: Record<string, string | undefined>) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

/**
 * All vars that vitest.setup.ts seeds.
 * These are removed in isolation tests that need a minimal-env execution context.
 */
const RUNTIME_ONLY_VARS = [
  'REDIS_URL',
  'JWT_SECRET',
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'GITHUB_CALLBACK_URL',
  'ADMIN_GITHUB_ID',
  'S3_ENDPOINT',
  'S3_BUCKET',
  'S3_ACCESS_KEY',
  'S3_SECRET_KEY',
  'S3_PUBLIC_DOMAIN',
  'TELEGRAM_BOT_TOKEN',
  'TELEGRAM_CHAT_ID',
  'TURNSTILE_SECRET',
  'ALLOWED_ORIGIN',
  'API_PUBLIC_URL',
  'IP_HASH_SALT',
];

const FULL_RUNTIME_BASE = {
  DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
  REDIS_URL: 'redis://localhost:6379',
  JWT_SECRET: '12345678901234567890123456789012',
  GITHUB_CLIENT_ID: 'test-client-id',
  GITHUB_CLIENT_SECRET: 'test-client-secret',
  GITHUB_CALLBACK_URL: 'https://example.com/api/auth/github/callback',
  ADMIN_GITHUB_ID: '12345',
  S3_ENDPOINT: 'https://example.com/s3',
  S3_BUCKET: 'test-bucket',
  S3_ACCESS_KEY: 'test-access-key',
  S3_SECRET_KEY: 'test-secret-key',
  S3_PUBLIC_DOMAIN: 'cdn.example.test',
  TELEGRAM_BOT_TOKEN: 'test-bot-token',
  TELEGRAM_CHAT_ID: 'test-chat-id',
  TURNSTILE_SECRET: 'test-turnstile-secret',
  ALLOWED_ORIGIN: 'https://example.com',
  API_PUBLIC_URL: 'https://example.com/api',
  IP_HASH_SALT: '1234567890abcdef',
  NODE_ENV: 'test' as const,
};

// ── databaseEnv schema ────────────────────────────────────────────────────────
// Schema tests use Zod safeParse with explicit inputs — no module reset required.

describe('databaseEnv schema (env.fields.ts)', () => {
  it('succeeds with only DATABASE_URL present', () => {
    const schema = z.object(databaseFields);
    const result = schema.safeParse({ DATABASE_URL: 'postgresql://user:pass@localhost:5432/test' });
    expect(result.success).toBe(true);
    expect(result.data?.DATABASE_URL).toBe('postgresql://user:pass@localhost:5432/test');
  });

  it('schema shape contains only DATABASE_URL (no Redis, OAuth, S3 keys)', () => {
    expect(Object.keys(databaseFields)).toEqual(['DATABASE_URL']);
  });

  it('validation fails when DATABASE_URL is absent', () => {
    const schema = z.object(databaseFields);
    const result = schema.safeParse({});
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('DATABASE_URL'))).toBe(true);
  });

  it('validation fails when DATABASE_URL is not a valid URL', () => {
    const schema = z.object(databaseFields);
    const result = schema.safeParse({ DATABASE_URL: 'not-a-url' });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('DATABASE_URL'))).toBe(true);
  });
});

// ── loggerEnv schema ──────────────────────────────────────────────────────────
// Schema tests use Zod parse with explicit inputs — no module reset required.

describe('loggerEnv schema (env.fields.ts)', () => {
  it('defaults NODE_ENV to "development" when the variable is absent', () => {
    const schema = z.object(loggerFields);
    const result = schema.parse({});
    expect(result.NODE_ENV).toBe('development');
  });

  it('respects an explicit NODE_ENV=production', () => {
    const schema = z.object(loggerFields);
    const result = schema.parse({ NODE_ENV: 'production' });
    expect(result.NODE_ENV).toBe('production');
  });

  it('respects an explicit NODE_ENV=test', () => {
    const schema = z.object(loggerFields);
    const result = schema.parse({ NODE_ENV: 'test' });
    expect(result.NODE_ENV).toBe('test');
  });

  it('schema shape contains only NODE_ENV (no DATABASE_URL, Redis, OAuth keys)', () => {
    expect(Object.keys(loggerFields)).toEqual(['NODE_ENV']);
  });
});

// ── Strict API runtime parser ─────────────────────────────────────────────────
// Schema tests use Zod safeParse with explicit inputs — no module reset required.

describe('strict API runtime env parser (schema validation)', () => {
  it('validation fails for full runtime schema when JWT_SECRET is absent', () => {
    const schema = z.object(apiRuntimeFields);
    const { JWT_SECRET: _jwtSecret, ...partial } = FULL_RUNTIME_BASE;
    const result = schema.safeParse(partial);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('JWT_SECRET'))).toBe(true);
  });

  it('validation fails for full runtime schema when REDIS_URL is absent', () => {
    const schema = z.object(apiRuntimeFields);
    const { REDIS_URL: _redisUrl, ...partial } = FULL_RUNTIME_BASE;
    const result = schema.safeParse(partial);
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('REDIS_URL'))).toBe(true);
  });
});

// ── Migration module isolation ────────────────────────────────────────────────
// Module resets are intentionally avoided here. In this repo's Bun+Vitest
// environment, module-reset helpers have not been reliable across runners, so
// the regression uses env isolation plus a real import instead.

describe('migrate module can be imported in minimal-env context', () => {
  let snapshot: Record<string, string | undefined>;

  beforeEach(() => {
    snapshot = captureEnv(['DATABASE_URL', 'NODE_ENV', ...RUNTIME_ONLY_VARS]);
    // Strip all runtime-only vars — keep only what DB scripts genuinely need.
    for (const key of RUNTIME_ONLY_VARS) {
      delete process.env[key];
    }
    process.env.DATABASE_URL = 'postgresql://user:pass@localhost:5432/test';
    process.env.NODE_ENV = 'test';
  });

  afterEach(() => {
    restoreEnv(snapshot);
  });

  it('does not throw on import when only DATABASE_URL is present', async () => {
    const migrateModule = await import('../db/migrate');

    // This import must not throw due to missing Redis/OAuth/S3 env vars.
    expect(migrateModule).toMatchObject({
      runMigrations: expect.any(Function),
    });

    const { pgClient } = await import('../config/db');
    await pgClient.end();
  });
});

// ── AI env fields ─────────────────────────────────────────────────────────────
// Validate the AI-specific env fields defined in env.fields.ts:
//  - defaults work correctly
//  - OPENROUTER_API_KEY is optional when AI feature is disabled
//  - cross-field constraint: OPENROUTER_API_KEY required when AI_POSTS_ENABLED=true
//  - AI_POSTS_MODEL_TOPICS and AI_POSTS_MODEL_DRAFT are no longer part of the runtime contract

describe('AI env fields (env.fields.ts)', () => {
  it('AI_POSTS_ENABLED defaults to false when not set', () => {
    const schema = z.object(apiRuntimeFields);
    const result = schema.parse(FULL_RUNTIME_BASE);
    expect(result.AI_POSTS_ENABLED).toBe(false);
  });

  it('AI_POSTS_ENABLED parses "true" to boolean true', () => {
    const schema = z.object(apiRuntimeFields);
    const result = schema.parse({ ...FULL_RUNTIME_BASE, AI_POSTS_ENABLED: 'true' });
    expect(result.AI_POSTS_ENABLED).toBe(true);
  });

  it('OPENROUTER_API_KEY is optional when AI_POSTS_ENABLED=false', () => {
    const schema = z.object(apiRuntimeFields);
    const result = schema.safeParse(FULL_RUNTIME_BASE); // no OPENROUTER_API_KEY
    expect(result.success).toBe(true);
  });

  it('AI_POSTS_MAX_SUGGESTIONS defaults to 4', () => {
    const schema = z.object(apiRuntimeFields);
    const result = schema.parse(FULL_RUNTIME_BASE);
    expect(result.AI_POSTS_MAX_SUGGESTIONS).toBe(4);
  });

  it('AI_POSTS_MODEL_TOPICS is not a runtime env field (removed in OpenRouter migration)', () => {
    expect('AI_POSTS_MODEL_TOPICS' in apiRuntimeFields).toBe(false);
  });

  it('AI_POSTS_MODEL_DRAFT is not a runtime env field (removed in OpenRouter migration)', () => {
    expect('AI_POSTS_MODEL_DRAFT' in apiRuntimeFields).toBe(false);
  });

  it('AI_POSTS_TIMEOUT_MS defaults to 30000', () => {
    const schema = z.object(apiRuntimeFields);
    const result = schema.parse(FULL_RUNTIME_BASE);
    expect(result.AI_POSTS_TIMEOUT_MS).toBe(30_000);
  });

  it('cross-field: OPENROUTER_API_KEY required when AI_POSTS_ENABLED=true (mirrors env.ts startup guard)', () => {
    const schema = z.object(apiRuntimeFields).superRefine((data, ctx) => {
      if (data.AI_POSTS_ENABLED && !data.OPENROUTER_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OPENROUTER_API_KEY'],
          message: 'OPENROUTER_API_KEY is required when AI_POSTS_ENABLED=true',
        });
      }
    });
    const result = schema.safeParse({
      ...FULL_RUNTIME_BASE,
      AI_POSTS_ENABLED: 'true',
      // OPENROUTER_API_KEY intentionally absent
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues.some((i) => i.path.includes('OPENROUTER_API_KEY'))).toBe(true);
  });

  it('cross-field: passes when AI_POSTS_ENABLED=true and OPENROUTER_API_KEY is provided', () => {
    const schema = z.object(apiRuntimeFields).superRefine((data, ctx) => {
      if (data.AI_POSTS_ENABLED && !data.OPENROUTER_API_KEY) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['OPENROUTER_API_KEY'],
          message: 'OPENROUTER_API_KEY is required when AI_POSTS_ENABLED=true',
        });
      }
    });
    const result = schema.safeParse({
      ...FULL_RUNTIME_BASE,
      AI_POSTS_ENABLED: 'true',
      OPENROUTER_API_KEY: 'sk-or-test-key',
    });
    expect(result.success).toBe(true);
  });
});
