import { describe, expect, it } from 'vitest';
import { env } from './env';

describe('worker env config', () => {
  it('loads required environment values', () => {
    const dbProtocol = new URL(env.DATABASE_URL).protocol;

    expect(env.NODE_ENV).toBe('test');
    expect(dbProtocol === 'postgresql:' || dbProtocol === 'postgres:').toBe(true);
    expect(() => new URL(env.REDIS_URL)).not.toThrow();
    expect(env.S3_BUCKET.length).toBeGreaterThan(0);
    expect(env.IP_HASH_SALT.length).toBeGreaterThanOrEqual(16);
  });
});
