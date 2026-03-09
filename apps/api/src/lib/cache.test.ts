import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getMock, setMock, scanMock, delMock } = vi.hoisted(() => ({
  getMock: vi.fn(),
  setMock: vi.fn(),
  scanMock: vi.fn(),
  delMock: vi.fn(),
}));

vi.mock('../config/redis', () => ({
  redis: {
    get: getMock,
    set: setMock,
    scan: scanMock,
    del: delMock,
  },
}));

import { cached, invalidatePattern } from './cache';

describe('cache utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    // Ensure del always returns a Promise so .catch() chaining works
    // (used in anti-stampede lock release and corrupt-entry eviction)
    delMock.mockResolvedValue(1);
  });

  it('cached returns Redis hit without calling fetcher', async () => {
    getMock.mockResolvedValueOnce(JSON.stringify({ value: 42 }));
    const fetcher = vi.fn(async () => ({ value: 99 }));

    const result = await cached('posts:list:1', 300, fetcher);

    expect(result).toEqual({ value: 42 });
    expect(fetcher).not.toHaveBeenCalled();
    expect(setMock).not.toHaveBeenCalled();
  });

  it('cached stores miss value with TTL and returns fetcher result', async () => {
    getMock.mockResolvedValueOnce(null);
    setMock.mockResolvedValueOnce('OK').mockResolvedValueOnce('OK');
    const fetcher = vi.fn(async () => ({ value: 99 }));

    const result = await cached('posts:list:1', 300, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(setMock).toHaveBeenCalledWith('posts:list:1', JSON.stringify({ value: 99 }), 'EX', 300);
    expect(result).toEqual({ value: 99 });
  });

  it('cached evicts corrupted entry and repopulates cache', async () => {
    getMock.mockResolvedValueOnce('{invalid-json}');
    setMock.mockResolvedValueOnce('OK').mockResolvedValueOnce('OK');
    const fetcher = vi.fn(async () => ({ value: 77 }));

    const result = await cached('posts:slug:broken', 600, fetcher);

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(delMock).toHaveBeenCalledWith('posts:slug:broken');
    expect(setMock).toHaveBeenNthCalledWith(1, 'lock:posts:slug:broken', '1', 'EX', 30, 'NX');
    expect(setMock).toHaveBeenNthCalledWith(
      2,
      'posts:slug:broken',
      JSON.stringify({ value: 77 }),
      'EX',
      600
    );
    expect(delMock).toHaveBeenCalledWith('lock:posts:slug:broken');
    expect(result).toEqual({ value: 77 });
  });

  it('cached returns retry hit when lock is already held', async () => {
    vi.useFakeTimers();
    getMock.mockResolvedValueOnce(null).mockResolvedValueOnce(JSON.stringify({ value: 123 }));
    setMock.mockResolvedValueOnce(null);
    const fetcher = vi.fn(async () => ({ value: 999 }));

    const pending = cached('posts:list:retry-hit', 300, fetcher);
    await vi.advanceTimersByTimeAsync(75);
    const result = await pending;

    expect(fetcher).not.toHaveBeenCalled();
    expect(result).toEqual({ value: 123 });
    expect(setMock).toHaveBeenCalledWith('lock:posts:list:retry-hit', '1', 'EX', 30, 'NX');
  });

  it('cached falls back to fetcher when lock is held and retry is still a miss', async () => {
    vi.useFakeTimers();
    getMock.mockResolvedValueOnce(null).mockResolvedValueOnce(null);
    setMock.mockResolvedValueOnce(null).mockResolvedValueOnce('OK');
    const fetcher = vi.fn(async () => ({ value: 55 }));

    const pending = cached('posts:list:retry-miss', 120, fetcher);
    await vi.advanceTimersByTimeAsync(75);
    const result = await pending;

    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ value: 55 });
    // Lock release should not run because this request never acquired the lock.
    expect(delMock).not.toHaveBeenCalledWith('lock:posts:list:retry-miss');
    expect(setMock).toHaveBeenNthCalledWith(1, 'lock:posts:list:retry-miss', '1', 'EX', 30, 'NX');
    expect(setMock).toHaveBeenNthCalledWith(
      2,
      'posts:list:retry-miss',
      JSON.stringify({ value: 55 }),
      'EX',
      120
    );
  });

  it('invalidatePattern removes keys via SCAN pages and DEL', async () => {
    scanMock
      .mockResolvedValueOnce(['1', ['posts:a', 'posts:b']])
      .mockResolvedValueOnce(['0', ['posts:c']]);
    delMock.mockResolvedValue(1);

    await invalidatePattern('posts:*');

    expect(scanMock).toHaveBeenNthCalledWith(1, '0', 'MATCH', 'posts:*', 'COUNT', 100);
    expect(scanMock).toHaveBeenNthCalledWith(2, '1', 'MATCH', 'posts:*', 'COUNT', 100);
    expect(delMock).toHaveBeenNthCalledWith(1, 'posts:a', 'posts:b');
    expect(delMock).toHaveBeenNthCalledWith(2, 'posts:c');
  });

  it('invalidatePattern does not call DEL when no keys are found', async () => {
    scanMock.mockResolvedValueOnce(['0', []]);

    await invalidatePattern('empty:*');

    expect(scanMock).toHaveBeenCalledWith('0', 'MATCH', 'empty:*', 'COUNT', 100);
    expect(delMock).not.toHaveBeenCalled();
  });
});
