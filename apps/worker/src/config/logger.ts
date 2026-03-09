import { mkdir } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  getLogger as _getLogger,
  configure,
  getConsoleSink,
  type LogRecord,
} from '@logtape/logtape';
import { env } from './env';

let configured = false;
const appRootDir = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const logsDir = resolve(appRootDir, 'logs');

export async function setupLogger(): Promise<void> {
  if (configured) return;
  configured = true;

  const sinks: Record<string, (record: LogRecord) => void> = {
    console: getConsoleSink(),
  };

  if (env.NODE_ENV !== 'test') {
    try {
      await mkdir(logsDir, { recursive: true });
      const { getFileSink } = await import('@logtape/file');
      sinks.file = getFileSink(resolve(logsDir, 'worker.log'));
    } catch {
      console.warn('[Logger] @logtape/file not available');
    }
  }

  await configure({
    sinks,
    loggers: [
      {
        category: ['portfolio', 'worker'],
        lowestLevel: env.NODE_ENV === 'production' ? 'info' : 'debug',
        sinks: Object.keys(sinks),
      },
      {
        category: ['logtape', 'meta'],
        lowestLevel: 'warning',
        sinks: ['console'],
      },
    ],
  });
}

export function getLogger(...subcategory: string[]) {
  return _getLogger(['portfolio', 'worker', ...subcategory]);
}
