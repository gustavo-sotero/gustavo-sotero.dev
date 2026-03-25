/**
 * Unit tests for worker cache invalidation helpers.
 *
 * Verifies best-effort semantics: Redis failures are logged as warnings and
 * must not cause invalidatePattern to throw.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const { redisScanMock, redisDelMock, redisQuitMock, redisDisconnectMock } = vi.hoisted(() => ({
  redisScanMock: vi.fn(),
  redisDelMock: vi.fn(),
  redisQuitMock: vi.fn().mockResolvedValue(undefined),
  redisDisconnectMock: vi.fn(),
}));

const { warnMock } = vi.hoisted(() => ({
  warnMock: vi.fn(),
}));

vi.mock('ioredis', () => {
  const RedisMock = vi.fn(function RedisMock() {
    return {
      scan: redisScanMock,
      del: redisDelMock,
      quit: redisQuitMock,
      disconnect: redisDisconnectMock,
    };
  });

  return {
    default: RedisMock,
  };
});

vi.mock('../config/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: warnMock,
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('../config/env', () => ({
  env: { REDIS_URL: 'redis://localhost:6379' },
}));

import { invalidatePattern } from './cache';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('invalidatePattern', () => {
  it('deletes keys matching the pattern via SCAN', async () => {
    redisScanMock
      .mockResolvedValueOnce(['42', ['posts:list', 'posts:slug:a']])
      .mockResolvedValueOnce(['0', []]);
    redisDelMock.mockResolvedValue(2);

    await invalidatePattern('posts:*');

    expect(redisScanMock).toHaveBeenCalledTimes(2);
    expect(redisDelMock).toHaveBeenCalledWith('posts:list', 'posts:slug:a');
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('handles an empty result set (no matching keys)', async () => {
    redisScanMock.mockResolvedValueOnce(['0', []]);

    await invalidatePattern('ghost:*');

    expect(redisDelMock).not.toHaveBeenCalled();
    expect(warnMock).not.toHaveBeenCalled();
  });

  it('resolves without throwing when Redis scan fails', async () => {
    redisScanMock.mockRejectedValueOnce(new Error('Redis connection refused'));

    // Must not throw — best-effort semantics
    await expect(invalidatePattern('posts:*')).resolves.toBeUndefined();

    expect(warnMock).toHaveBeenCalledWith(
      'Cache invalidation failed — stale data may be served until TTL',
      expect.objectContaining({
        pattern: 'posts:*',
        error: 'Redis connection refused',
      })
    );
  });

  it('resolves without throwing when Redis del fails mid-scan', async () => {
    redisScanMock.mockResolvedValueOnce(['0', ['posts:slug:a']]);
    redisDelMock.mockRejectedValueOnce(new Error('ERR command timeout'));

    await expect(invalidatePattern('posts:*')).resolves.toBeUndefined();

    expect(warnMock).toHaveBeenCalledWith(
      'Cache invalidation failed — stale data may be served until TTL',
      expect.objectContaining({
        pattern: 'posts:*',
        error: 'ERR command timeout',
      })
    );
  });
});
