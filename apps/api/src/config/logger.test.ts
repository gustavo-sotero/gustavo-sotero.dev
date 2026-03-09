import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Logger configuration tests.
 *
 * Strategy: capture the config object passed to LogTape's `configure()` by
 * mocking `@logtape/logtape`, then assert on the structure.
 * Module-level `configured` flag is reset by using `vi.resetModules()` so each
 * test gets a fresh module instance.
 */

// Types imported for clarity only — actual value comes from the mock capture.
type LoggerConfig = {
  sinks: Record<string, unknown>;
  loggers: Array<{
    category: string[];
    lowestLevel: string;
    sinks: string[];
  }>;
};

// ── Shared helpers ────────────────────────────────────────────────────────────

/**
 * Build a fresh `setupLogger` import with the given NODE_ENV and capture
 * the config passed to `configure()`.
 */
async function buildLogger(nodeEnv: string): Promise<LoggerConfig> {
  vi.resetModules();

  let captured: LoggerConfig | undefined;

  vi.doMock('@logtape/logtape', () => ({
    configure: async (cfg: LoggerConfig) => {
      captured = cfg;
    },
    getConsoleSink: () => () => {},
    getAnsiColorFormatter: () => () => {},
    getJsonLinesFormatter: () => () => {},
    getLogger: () => ({
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    }),
  }));

  vi.doMock('@logtape/file', () => ({
    getFileSink: (_path: string, _opts?: unknown) => () => {},
  }));

  vi.doMock('./env', () => ({ env: { NODE_ENV: nodeEnv } }));

  const { setupLogger } = await import('./logger');
  await setupLogger();

  if (!captured) throw new Error('configure() was never called');
  return captured;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('setupLogger() — test environment', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('is idempotent — calling twice does not throw', async () => {
    vi.resetModules();
    vi.doMock('@logtape/logtape', () => ({
      configure: vi.fn(),
      getConsoleSink: () => () => {},
      getAnsiColorFormatter: () => () => {},
      getJsonLinesFormatter: () => () => {},
      getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() }),
    }));
    vi.doMock('./env', () => ({ env: { NODE_ENV: 'test' } }));

    const { setupLogger } = await import('./logger');
    await expect(setupLogger()).resolves.toBeUndefined();
    await expect(setupLogger()).resolves.toBeUndefined();
  });

  it('registers portfolio:api category with debug level in test/dev', async () => {
    const config = await buildLogger('test');
    const apiLogger = config.loggers.find(
      (l) => l.category.join(':') === 'portfolio:api' && l.category.length === 2
    );
    expect(apiLogger).toBeDefined();
    expect(apiLogger?.lowestLevel).toBe('debug');
  });

  it('registers portfolio:api:http category', async () => {
    const config = await buildLogger('test');
    const httpLogger = config.loggers.find((l) => l.category.join(':') === 'portfolio:api:http');
    expect(httpLogger).toBeDefined();
    expect(httpLogger?.lowestLevel).toBe('info');
  });

  it('registers logtape:meta category at warning level', async () => {
    const config = await buildLogger('test');
    const metaLogger = config.loggers.find((l) => l.category.join(':') === 'logtape:meta');
    expect(metaLogger).toBeDefined();
    expect(metaLogger?.lowestLevel).toBe('warning');
  });

  it('uses only console sink in test environment', async () => {
    const config = await buildLogger('test');
    expect(Object.keys(config.sinks)).toContain('console');
    // No file or jsonl sinks in test
    expect(Object.keys(config.sinks)).not.toContain('file');
    expect(Object.keys(config.sinks)).not.toContain('jsonl');
  });
});

describe('setupLogger() — production/development environment', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('adds a jsonl sink in production environment', async () => {
    const config = await buildLogger('production');
    expect(Object.keys(config.sinks)).toContain('jsonl');
  });

  it('adds a file sink in production environment', async () => {
    const config = await buildLogger('production');
    expect(Object.keys(config.sinks)).toContain('file');
  });

  it('uses info as the minimum level for portfolio:api in production', async () => {
    const config = await buildLogger('production');
    const apiLogger = config.loggers.find(
      (l) => l.category.join(':') === 'portfolio:api' && l.category.length === 2
    );
    expect(apiLogger?.lowestLevel).toBe('info');
  });

  it('portfolio:api category points to all sinks including jsonl', async () => {
    const config = await buildLogger('production');
    const apiLogger = config.loggers.find(
      (l) => l.category.join(':') === 'portfolio:api' && l.category.length === 2
    );
    expect(apiLogger?.sinks).toContain('console');
    expect(apiLogger?.sinks).toContain('file');
    expect(apiLogger?.sinks).toContain('jsonl');
  });

  it('logtape:meta category does NOT include jsonl sink', async () => {
    const config = await buildLogger('production');
    const metaLogger = config.loggers.find((l) => l.category.join(':') === 'logtape:meta');
    expect(metaLogger?.sinks).not.toContain('jsonl');
  });
});
