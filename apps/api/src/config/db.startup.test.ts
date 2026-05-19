import { describe, expect, it, vi } from 'vitest';
import {
  getDatabaseStartupRetryDelayMs,
  isRetryableDatabaseStartupError,
  waitForDatabaseStartup,
} from './db.startup';

function createLoggerMock() {
  return {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  };
}

describe('db startup retry', () => {
  it('retries transient DNS failures until the probe succeeds', async () => {
    const dnsError = Object.assign(new Error('getaddrinfo ENOTFOUND postgres'), {
      code: 'ENOTFOUND',
    });
    const probe = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(dnsError)
      .mockRejectedValueOnce(dnsError)
      .mockResolvedValueOnce(undefined);
    const sleep = vi.fn<(_: number) => Promise<void>>().mockResolvedValue(undefined);
    const logger = createLoggerMock();

    await waitForDatabaseStartup({
      host: 'postgres',
      probe,
      sleep,
      log: logger,
      maxAttempts: 5,
      baseDelayMs: 100,
      maxDelayMs: 1_000,
    });

    expect(probe).toHaveBeenCalledTimes(3);
    expect(sleep).toHaveBeenNthCalledWith(1, 100);
    expect(sleep).toHaveBeenNthCalledWith(2, 200);
    expect(logger.warn).toHaveBeenCalledTimes(2);
    expect(logger.info).toHaveBeenCalledWith('Database connectivity established after retry', {
      host: 'postgres',
      attempt: 3,
    });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('does not retry permanent database errors', async () => {
    const authError = Object.assign(
      new Error('password authentication failed for user "portfolio"'),
      {
        code: '28P01',
      }
    );
    const probe = vi.fn<() => Promise<void>>().mockRejectedValueOnce(authError);
    const sleep = vi.fn<(_: number) => Promise<void>>().mockResolvedValue(undefined);
    const logger = createLoggerMock();

    await expect(
      waitForDatabaseStartup({
        host: 'postgres',
        probe,
        sleep,
        log: logger,
      })
    ).rejects.toBe(authError);

    expect(probe).toHaveBeenCalledTimes(1);
    expect(sleep).not.toHaveBeenCalled();
    expect(logger.warn).not.toHaveBeenCalled();
    expect(logger.error).toHaveBeenCalledWith(
      'Database connectivity probe failed with a non-retryable error',
      {
        host: 'postgres',
        attempt: 1,
        error: 'password authentication failed for user "portfolio"',
      }
    );
  });

  it('detects retryable causes wrapped by higher-level query errors', () => {
    const dnsError = Object.assign(new Error('getaddrinfo ENOTFOUND postgres'), {
      code: 'ENOTFOUND',
    });
    const wrappedError = new Error('Failed query: SELECT pg_advisory_lock(8301981)');
    Object.assign(wrappedError, { cause: dnsError });

    expect(isRetryableDatabaseStartupError(wrappedError)).toBe(true);
    expect(getDatabaseStartupRetryDelayMs(1, 100, 1_000)).toBe(100);
    expect(getDatabaseStartupRetryDelayMs(2, 100, 1_000)).toBe(200);
    expect(getDatabaseStartupRetryDelayMs(5, 250, 2_000)).toBe(2_000);
  });
});
