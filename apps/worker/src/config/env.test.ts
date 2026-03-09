import { describe, expect, it } from 'vitest';
import { env } from './env';

describe('worker env config', () => {
  it('loads required environment values', () => {
    expect(env.NODE_ENV).toBe('test');
    expect(env.DATABASE_URL).toContain('postgresql://');
    expect(env.REDIS_URL).toContain('redis://');
    expect(env.S3_BUCKET.length).toBeGreaterThan(0);
    expect(env.IP_HASH_SALT.length).toBeGreaterThanOrEqual(16);
  });
});
