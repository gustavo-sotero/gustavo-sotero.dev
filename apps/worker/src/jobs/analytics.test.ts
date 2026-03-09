/**
 * Tests for the analytics event persistence job handler.
 *
 * Covers:
 *  - Persists analytics event with hashed IP
 *  - Uses event timestamp as createdAt
 *  - Handles null/missing optional fields (userAgent, country)
 *  - Does not store raw IP address
 */

import type { Job } from 'bullmq';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { dbInsertMock, dbInsertValuesMock } = vi.hoisted(() => ({
  dbInsertMock: vi.fn(),
  dbInsertValuesMock: vi.fn(),
}));

dbInsertMock.mockImplementation(() => ({
  values: dbInsertValuesMock,
}));
dbInsertValuesMock.mockResolvedValue(undefined);

vi.mock('../config/db', () => ({
  db: {
    insert: dbInsertMock,
  },
}));

vi.mock('../config/env', () => ({
  env: {
    IP_HASH_SALT: 'test-salt-at-least-16-chars',
    NODE_ENV: 'test',
  },
}));

vi.mock('../config/logger', () => ({
  getLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock('@portfolio/shared/db/schema', () => ({
  analyticsEvents: Symbol('analyticsEvents'),
}));

import { type AnalyticsEventPayload, processAnalytics } from './analytics';

function makeJob(data: AnalyticsEventPayload): Job<AnalyticsEventPayload> {
  return {
    id: 'analytics-job-1',
    data,
    attemptsMade: 0,
    opts: {},
  } as unknown as Job<AnalyticsEventPayload>;
}

beforeEach(() => {
  vi.clearAllMocks();
  dbInsertMock.mockImplementation(() => ({ values: dbInsertValuesMock }));
  dbInsertValuesMock.mockResolvedValue(undefined);
});

describe('processAnalytics', () => {
  it('inserts an analytics event with hashed IP', async () => {
    const job = makeJob({
      path: '/projects',
      method: 'GET',
      statusCode: 200,
      userAgent: 'Mozilla/5.0',
      ip: '198.51.100.42',
      country: 'BR',
      timestamp: 1_700_000_000_000,
    });

    await processAnalytics(job);

    expect(dbInsertMock).toHaveBeenCalledTimes(1);
    expect(dbInsertValuesMock).toHaveBeenCalledTimes(1);

    const firstCall = dbInsertValuesMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const [insertedValues] = firstCall ?? [];
    // Raw IP must NOT be stored
    expect(JSON.stringify(insertedValues)).not.toContain('198.51.100.42');
    // ipHash must be present
    expect(insertedValues.ipHash).toBeDefined();
    expect(typeof insertedValues.ipHash).toBe('string');
    expect(insertedValues.ipHash.length).toBe(64); // SHA-256 hex = 64 chars
  });

  it('uses the event timestamp as createdAt', async () => {
    const timestamp = 1_700_000_000_000;
    const job = makeJob({
      path: '/blog',
      method: 'GET',
      statusCode: 200,
      ip: '10.0.0.1',
      timestamp,
    });

    await processAnalytics(job);

    const firstCall = dbInsertValuesMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const [insertedValues] = firstCall ?? [];
    expect(insertedValues.createdAt).toEqual(new Date(timestamp));
  });

  it('stores null for missing optional fields', async () => {
    const job = makeJob({
      path: '/posts',
      method: 'GET',
      statusCode: 200,
      ip: '10.0.0.2',
      timestamp: Date.now(),
    });

    await processAnalytics(job);

    const firstCall = dbInsertValuesMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const [insertedValues] = firstCall ?? [];
    expect(insertedValues.userAgent).toBeNull();
    expect(insertedValues.country).toBeNull();
  });

  it('stores country and userAgent when provided', async () => {
    const job = makeJob({
      path: '/contact',
      method: 'GET',
      statusCode: 200,
      ip: '10.0.0.3',
      country: 'US',
      userAgent: 'curl/7.88',
      timestamp: Date.now(),
    });

    await processAnalytics(job);

    const firstCall = dbInsertValuesMock.mock.calls.at(0);
    expect(firstCall).toBeDefined();
    const [insertedValues] = firstCall ?? [];
    expect(insertedValues.country).toBe('US');
    expect(insertedValues.userAgent).toBe('curl/7.88');
  });

  it('produces deterministic ipHash for same ip + salt', async () => {
    const sameIp = '172.16.0.1';
    const j1 = makeJob({
      path: '/a',
      method: 'GET',
      statusCode: 200,
      ip: sameIp,
      timestamp: Date.now(),
    });
    const j2 = makeJob({
      path: '/b',
      method: 'GET',
      statusCode: 200,
      ip: sameIp,
      timestamp: Date.now(),
    });

    await processAnalytics(j1);
    await processAnalytics(j2);

    const firstCall = dbInsertValuesMock.mock.calls.at(0);
    const secondCall = dbInsertValuesMock.mock.calls.at(1);
    expect(firstCall).toBeDefined();
    expect(secondCall).toBeDefined();
    const hash1 = (firstCall?.[0] as { ipHash: string }).ipHash;
    const hash2 = (secondCall?.[0] as { ipHash: string }).ipHash;
    expect(hash1).toBe(hash2);
  });
});
