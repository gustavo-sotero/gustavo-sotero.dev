/**
 * Shared Redis URL parser for BullMQ connections.
 *
 * Returns plain ioredis-compatible connection options including the options
 * required by BullMQ (`maxRetriesPerRequest: null`, `enableReadyCheck: false`).
 * Safe to spread additional options (e.g. `lazyConnect`) on top.
 */

/** Minimal set of ioredis options used across all workers/queues. */
interface BullMQConnectionBase {
  username?: string;
  password?: string;
  db?: number;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
}

type TcpBullMQConnectionOptions = BullMQConnectionBase & {
  host: string;
  port: number;
};

type SocketBullMQConnectionOptions = BullMQConnectionBase & {
  path: string;
};

export type BullMQConnectionOptions = TcpBullMQConnectionOptions | SocketBullMQConnectionOptions;

function parseDb(value: string | null | undefined): number {
  if (!value) return 0;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return 0;
  return Math.trunc(numeric);
}

function baseOptions(parsed: URL): BullMQConnectionBase {
  return {
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
  };
}

function isUnixSocketProtocol(protocol: string): boolean {
  return protocol === 'redis+unix:' || protocol === 'unix:';
}

/**
 * Parse a `redis://[user:pass@]host[:port][/db]` URL into ioredis connection
 * options with the BullMQ-required fields already set.
 *
 * On parse failure falls back to `127.0.0.1:6379` with the required options
 * so workers degrade gracefully in tests and local dev.
 */
export function parseRedisUrl(url: string): BullMQConnectionOptions {
  try {
    const parsed = new URL(url);

    if (isUnixSocketProtocol(parsed.protocol)) {
      const socketPath = decodeURIComponent(parsed.pathname || '');
      if (!socketPath) throw new Error('Invalid unix socket path');

      return {
        ...baseOptions(parsed),
        path: socketPath,
        db: parseDb(parsed.searchParams.get('db')),
      };
    }

    const dbPath = parsed.pathname ? parsed.pathname.replace('/', '') : '';

    return {
      ...baseOptions(parsed),
      host: parsed.hostname || '127.0.0.1',
      port: parsed.port ? Number(parsed.port) : 6379,
      db: parseDb(dbPath),
    };
  } catch {
    return {
      host: '127.0.0.1',
      port: 6379,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    };
  }
}
