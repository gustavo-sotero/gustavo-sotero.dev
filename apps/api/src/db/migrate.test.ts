import { beforeEach, describe, expect, it, vi } from 'vitest';

const { existsSyncMock, migrateMock, executeMock, warnMock, infoMock, verifyRequiredSchemaMock } =
  vi.hoisted(() => ({
    existsSyncMock: vi.fn(),
    migrateMock: vi.fn(),
    executeMock: vi.fn(),
    warnMock: vi.fn(),
    infoMock: vi.fn(),
    verifyRequiredSchemaMock: vi.fn(),
  }));

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
}));

vi.mock('drizzle-orm/postgres-js/migrator', () => ({
  migrate: migrateMock,
}));

vi.mock('../config/db', () => ({
  db: {
    execute: executeMock,
  },
  pgClient: {
    end: vi.fn(),
  },
}));

vi.mock('../config/logger', () => ({
  getLogger: vi.fn(() => ({
    warn: warnMock,
    info: infoMock,
  })),
}));

vi.mock('./verify-schema', () => ({
  verifyRequiredSchema: verifyRequiredSchemaMock,
}));

import { runMigrations } from './migrate';

describe('runMigrations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.ALLOW_MISSING_MIGRATIONS;
    existsSyncMock.mockReturnValue(true);
    migrateMock.mockResolvedValue(undefined);
    executeMock.mockResolvedValue([]);
    verifyRequiredSchemaMock.mockResolvedValue({ ok: true, missing: [] });
  });

  it('fails fast when the migrations folder is missing by default', async () => {
    existsSyncMock.mockReturnValue(false);

    await expect(runMigrations()).rejects.toThrow('Migrations folder not found');
    expect(migrateMock).not.toHaveBeenCalled();
    expect(verifyRequiredSchemaMock).not.toHaveBeenCalled();
  });

  it('allows skipping only when ALLOW_MISSING_MIGRATIONS=true', async () => {
    existsSyncMock.mockReturnValue(false);
    process.env.ALLOW_MISSING_MIGRATIONS = 'true';

    await expect(runMigrations()).resolves.toBeUndefined();
    expect(warnMock).toHaveBeenCalledTimes(1);
    expect(migrateMock).not.toHaveBeenCalled();
    expect(verifyRequiredSchemaMock).not.toHaveBeenCalled();
  });

  it('fails when schema parity is still broken after migrations', async () => {
    verifyRequiredSchemaMock.mockResolvedValueOnce({
      ok: false,
      missing: ['table:experience_tags'],
    });

    await expect(runMigrations()).rejects.toThrow('Schema parity check failed after migrations');
    expect(migrateMock).toHaveBeenCalledTimes(1);
    expect(verifyRequiredSchemaMock).toHaveBeenCalledTimes(1);
    expect(executeMock).toHaveBeenCalledTimes(2);
  });
});
