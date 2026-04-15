/**
 * Tests for apps/worker queue setup and Redis URL parsing.
 *
 * Validates:
 * - All queue instances are created with the correct names
 * - parseRedisUrl handles well-formed, minimal, and fallback URL forms
 */

import { describe, expect, it, vi } from 'vitest';

// ── Queue name contract tests ─────────────────────────────────────────────────

// Capture array must be hoisted so it's available when the vi.mock factory runs
const capturedQueues = vi.hoisted(() => [] as Array<{ name: string }>);

vi.mock('bullmq', () => {
  const QueueMock = function (this: { name: string }, name: string) {
    capturedQueues.push({ name });
    this.name = name;
  };
  return {
    Queue: vi.fn().mockImplementation(QueueMock),
    Worker: vi.fn().mockImplementation(() => {}),
    QueueEvents: vi.fn().mockImplementation(() => {}),
  };
});

vi.mock('./config/env', () => ({
  env: {
    REDIS_URL: 'redis://localhost:6379',
    DATABASE_URL: 'postgresql://user:pass@localhost:5432/test',
    S3_ENDPOINT: 'http://localhost:9000',
    S3_BUCKET: 'test',
    S3_ACCESS_KEY: 'key',
    S3_SECRET_KEY: 'secret',
    S3_REGION: 'auto',
    S3_PUBLIC_DOMAIN: 'cdn.example.test',
    TELEGRAM_BOT_TOKEN: 'bot-token',
    TELEGRAM_CHAT_ID: 'chat-id',
    IP_HASH_SALT: 'salt',
    NODE_ENV: 'test',
  },
}));

// Import after mocks are in place so the module initialises with mocked Queue
import './queues';

describe('worker queue names', () => {
  const names = capturedQueues.map((q) => q.name);

  it('registers telegram-notifications queue', () => {
    expect(names).toContain('telegram-notifications');
  });

  it('registers telegram-notifications-dlq queue', () => {
    expect(names).toContain('telegram-notifications-dlq');
  });

  it('registers analytics-events queue', () => {
    expect(names).toContain('analytics-events');
  });

  it('registers image-optimize queue', () => {
    expect(names).toContain('image-optimize');
  });

  it('registers image-optimize-dlq queue', () => {
    expect(names).toContain('image-optimize-dlq');
  });

  it('registers data-retention queue', () => {
    expect(names).toContain('data-retention');
  });

  it('registers post-publish queue', () => {
    expect(names).toContain('post-publish');
  });

  it('registers ai-post-draft-generation queue', () => {
    expect(names).toContain('ai-post-draft-generation');
  });

  it('registers no unexpected queues', () => {
    const expected = new Set([
      'telegram-notifications',
      'telegram-notifications-dlq',
      'analytics-events',
      'image-optimize',
      'image-optimize-dlq',
      'data-retention',
      'post-publish',
      'ai-post-draft-generation',
    ]);
    for (const name of names) {
      expect(expected).toContain(name);
    }
  });
});

// ── parseRedisUrl contract tests ──────────────────────────────────────────────

import { parseRedisUrl } from '@portfolio/shared/lib/redis';

describe('parseRedisUrl', () => {
  it('parses a full redis URL with auth and DB index', () => {
    const opts = parseRedisUrl('redis://user:secret@redis.example.com:6380/2');

    expect('host' in opts).toBe(true);
    if (!('host' in opts)) return;
    expect(opts.host).toBe('redis.example.com');
    expect(opts.port).toBe(6380);
    expect(opts.username).toBe('user');
    expect(opts.password).toBe('secret');
    expect(opts.db).toBe(2);
  });

  it('parses a minimal redis URL (host only)', () => {
    const opts = parseRedisUrl('redis://redis-host');

    expect('host' in opts).toBe(true);
    if (!('host' in opts)) return;
    expect(opts.host).toBe('redis-host');
    expect(opts.port).toBe(6379);
    expect(opts.db).toBe(0);
    expect(opts.username).toBeUndefined();
    expect(opts.password).toBeUndefined();
  });

  it('always sets maxRetriesPerRequest: null (required by BullMQ)', () => {
    const opts = parseRedisUrl('redis://localhost:6379');
    expect(opts.maxRetriesPerRequest).toBeNull();
  });

  it('always sets enableReadyCheck: false (required by BullMQ)', () => {
    const opts = parseRedisUrl('redis://localhost:6379');
    expect(opts.enableReadyCheck).toBe(false);
  });

  it('falls back to 127.0.0.1:6379 for an invalid URL and retains BullMQ options', () => {
    const opts = parseRedisUrl('not-a-valid-url');

    expect('host' in opts).toBe(true);
    if (!('host' in opts)) return;
    expect(opts.host).toBe('127.0.0.1');
    expect(opts.port).toBe(6379);
    expect(opts.maxRetriesPerRequest).toBeNull();
    expect(opts.enableReadyCheck).toBe(false);
  });

  it('handles a URL without port, defaulting to 6379', () => {
    const opts = parseRedisUrl('redis://my-redis');
    expect('host' in opts).toBe(true);
    if (!('host' in opts)) return;
    expect(opts.port).toBe(6379);
  });

  it('parses password-only auth (no username)', () => {
    const opts = parseRedisUrl('redis://:mypassword@localhost:6379');
    expect(opts.password).toBe('mypassword');
    // Empty username should become undefined (falsy)
    expect(opts.username).toBeFalsy();
  });

  it('parses redis+unix socket URL with db query parameter', () => {
    const opts = parseRedisUrl('redis+unix:///var/run/redis.sock?db=3');

    expect('path' in opts ? opts.path : undefined).toBe('/var/run/redis.sock');
    expect(opts.db).toBe(3);
    expect('host' in opts).toBe(false);
  });

  it('falls back db to 0 for invalid unix db values', () => {
    const opts = parseRedisUrl('unix:///tmp/redis.sock?db=abc');

    expect('path' in opts ? opts.path : undefined).toBe('/tmp/redis.sock');
    expect(opts.db).toBe(0);
  });
});
