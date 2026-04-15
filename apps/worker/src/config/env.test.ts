import { describe, expect, it } from 'vitest';
import { env, workerEnvSchema } from './env';

const MINIMAL_WORKER_ENV = {
  DATABASE_URL: 'postgres://postgres:postgres@localhost:5432/portfolio_test',
  REDIS_URL: 'redis://localhost:6379',
  S3_ENDPOINT: 'https://s3.example.com',
  S3_BUCKET: 'portfolio-bucket',
  S3_ACCESS_KEY: 'access-key',
  S3_SECRET_KEY: 'secret-key',
  S3_REGION: 'auto',
  S3_PUBLIC_DOMAIN: 'cdn.example.com',
  TELEGRAM_BOT_TOKEN: 'telegram-token',
  TELEGRAM_CHAT_ID: '123456789',
  IP_HASH_SALT: '1234567890abcdef',
  NODE_ENV: 'test' as const,
};

describe('worker env config', () => {
  it('loads required environment values', () => {
    const dbProtocol = new URL(env.DATABASE_URL).protocol;

    expect(env.NODE_ENV).toBe('test');
    expect(dbProtocol === 'postgresql:' || dbProtocol === 'postgres:').toBe(true);
    expect(() => new URL(env.REDIS_URL)).not.toThrow();
    expect(env.S3_BUCKET.length).toBeGreaterThan(0);
    expect(env.IP_HASH_SALT.length).toBeGreaterThanOrEqual(16);
  });

  it('accepts missing OPENROUTER_API_KEY when AI_POSTS_ENABLED=false', () => {
    const result = workerEnvSchema.safeParse(MINIMAL_WORKER_ENV);

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.AI_POSTS_ENABLED).toBe(false);
      expect(result.data.OPENROUTER_API_KEY).toBeUndefined();
    }
  });

  it('treats blank OPENROUTER_API_KEY as absent when AI_POSTS_ENABLED=false', () => {
    const result = workerEnvSchema.safeParse({
      ...MINIMAL_WORKER_ENV,
      OPENROUTER_API_KEY: '   ',
    });

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.OPENROUTER_API_KEY).toBeUndefined();
    }
  });

  it('requires OPENROUTER_API_KEY when AI_POSTS_ENABLED=true', () => {
    const result = workerEnvSchema.safeParse({
      ...MINIMAL_WORKER_ENV,
      AI_POSTS_ENABLED: 'true',
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(
        result.error.issues.some(
          (issue) =>
            issue.path.join('.') === 'OPENROUTER_API_KEY' &&
            issue.message === 'OPENROUTER_API_KEY is required when AI_POSTS_ENABLED=true'
        )
      ).toBe(true);
    }
  });
});
