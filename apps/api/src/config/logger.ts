import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getLogger as _getLogger,
  configure,
  getAnsiColorFormatter,
  getConsoleSink,
  getJsonLinesFormatter,
  type LogRecord,
} from '@logtape/logtape';
import { type LoggerEnv, loggerEnv } from './env.logger';

let configured = false;
const appRootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const logsDir = resolve(appRootDir, 'logs');

export interface SetupLoggerOptions {
  nodeEnv?: LoggerEnv['NODE_ENV'];
  configureImpl?: typeof configure;
  mkdirImpl?: typeof mkdir;
  loadFileSinkModule?: () => Promise<Pick<typeof import('@logtape/file'), 'getFileSink'>>;
}

/**
 * Console formatter that shows timestamp, level, category, message and all
 * structured properties inline — so errors are readable without opening a file.
 */
const consoleFormatter = getAnsiColorFormatter({
  timestamp: 'time-tz',
  level: 'FULL',
});

/**
 * JSONL formatter for file sinks: flattens structured properties to top-level
 * fields for easy `jq` / Loki / ELK ingestion.
 *
 * Example line:
 *   {"timestamp":"2026-02-26T12:00:00Z","level":"error","category":"portfolio.api.errors",
 *    "message":"[POST /admin/posts] UnhandledError: something blew up",
 *    "requestId":"abc","path":"/admin/posts","method":"POST","stack":"Error…"}
 */
const jsonlFormatter = getJsonLinesFormatter({
  properties: 'flatten',
  message: 'rendered',
});

/**
 * Initialize LogTape with console and structured-file sinks.
 * Must be called before using getLogger().
 */
export async function setupLogger(options: SetupLoggerOptions = {}): Promise<void> {
  if (configured) return;
  configured = true;

  const nodeEnv = options.nodeEnv ?? loggerEnv.NODE_ENV;
  const configureImpl = options.configureImpl ?? configure;
  const mkdirImpl = options.mkdirImpl ?? mkdir;
  const loadFileSinkModule =
    options.loadFileSinkModule ?? (async () => await import('@logtape/file'));

  const sinks: Record<string, (record: LogRecord) => void> = {
    console: getConsoleSink({ formatter: consoleFormatter }),
  };

  // In non-test environments, also write to file (plain text) and JSONL (structured)
  if (nodeEnv !== 'test') {
    try {
      await mkdirImpl(logsDir, { recursive: true });
      const { getFileSink } = await loadFileSinkModule();

      // Human-readable file for quick tail -f
      sinks.file = getFileSink(resolve(logsDir, 'api.log'));

      // Structured JSONL for post-incident analysis, jq, or log aggregators
      sinks.jsonl = getFileSink(resolve(logsDir, 'api.jsonl'), {
        formatter: jsonlFormatter,
      });
    } catch {
      // @logtape/file might not be installed in minimal setups
      console.warn('[Logger] @logtape/file not available, file logging disabled');
    }
  }

  const allSinks = Object.keys(sinks);
  const persistedSinks = allSinks.filter((k) => k !== 'console');

  await configureImpl({
    sinks,
    loggers: [
      {
        category: ['portfolio', 'api'],
        lowestLevel: nodeEnv === 'production' ? 'info' : 'debug',
        // All sinks: console + file + jsonl (when available)
        sinks: allSinks,
      },
      // @logtape/hono uses this category for HTTP access logs
      {
        category: ['portfolio', 'api', 'http'],
        lowestLevel: 'info',
        sinks: allSinks,
      },
      {
        category: ['logtape', 'meta'],
        lowestLevel: 'warning',
        // Internal LogTape events only to console + text file (not JSONL noise)
        sinks: ['console', ...persistedSinks.filter((k) => k === 'file')],
      },
    ],
  });
}

export function resetLoggerStateForTests(): void {
  configured = false;
}

/**
 * Get a logger with a given sub-category under portfolio:api.
 * Usage: const logger = getLogger('http') → category: portfolio:api:http
 */
export function getLogger(...subcategory: string[]) {
  return _getLogger(['portfolio', 'api', ...subcategory]);
}
