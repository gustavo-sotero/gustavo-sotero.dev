export interface DatabaseStartupLogger {
  info(message: string, properties?: Record<string, unknown>): void;
  warn(message: string, properties?: Record<string, unknown>): void;
  error(message: string, properties?: Record<string, unknown>): void;
}

export interface WaitForDatabaseStartupOptions {
  host: string;
  probe: () => Promise<unknown>;
  sleep?: (delayMs: number) => Promise<void>;
  log?: DatabaseStartupLogger;
  maxAttempts?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
}

const RETRYABLE_DATABASE_ERROR_CODES = new Set([
  'EAI_AGAIN',
  'ECONNREFUSED',
  'ECONNRESET',
  'ENOTFOUND',
  'ETIMEDOUT',
  'EHOSTUNREACH',
  '57P03',
]);

const RETRYABLE_DATABASE_ERROR_MESSAGES = [
  'connection refused',
  'connection reset',
  'database system is starting up',
  'getaddrinfo',
  'timeout',
  'timed out',
];

const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_BASE_DELAY_MS = 250;
const DEFAULT_MAX_DELAY_MS = 5_000;

type ErrorLike = {
  cause?: unknown;
  code?: unknown;
  message?: unknown;
};

function collectErrorChain(error: unknown): ErrorLike[] {
  const chain: ErrorLike[] = [];
  const seen = new Set<unknown>();
  let current = error;

  while (current && typeof current === 'object' && !seen.has(current)) {
    seen.add(current);
    chain.push(current as ErrorLike);
    current = (current as ErrorLike).cause;
  }

  return chain;
}

export function describeDatabaseStartupError(error: unknown): string {
  const chain = collectErrorChain(error);

  for (const entry of chain) {
    if (typeof entry.message === 'string' && entry.message.length > 0) {
      return entry.message;
    }
  }

  if (typeof error === 'string' && error.length > 0) {
    return error;
  }

  return 'Unknown error';
}

export function isRetryableDatabaseStartupError(error: unknown): boolean {
  const chain = collectErrorChain(error);

  for (const entry of chain) {
    if (typeof entry.code === 'string' && RETRYABLE_DATABASE_ERROR_CODES.has(entry.code)) {
      return true;
    }

    if (typeof entry.message !== 'string') {
      continue;
    }

    const message = entry.message.toLowerCase();
    if (RETRYABLE_DATABASE_ERROR_MESSAGES.some((fragment) => message.includes(fragment))) {
      return true;
    }
  }

  return false;
}

export function getDatabaseStartupRetryDelayMs(
  attempt: number,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS
): number {
  const exponent = Math.max(0, attempt - 1);
  return Math.min(maxDelayMs, baseDelayMs * 2 ** exponent);
}

async function defaultSleep(delayMs: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}

export async function waitForDatabaseStartup({
  host,
  probe,
  sleep = defaultSleep,
  log,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  baseDelayMs = DEFAULT_BASE_DELAY_MS,
  maxDelayMs = DEFAULT_MAX_DELAY_MS,
}: WaitForDatabaseStartupOptions): Promise<void> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await probe();

      if (attempt > 1) {
        log?.info('Database connectivity established after retry', {
          host,
          attempt,
        });
      }

      return;
    } catch (error) {
      const errorSummary = describeDatabaseStartupError(error);

      if (!isRetryableDatabaseStartupError(error)) {
        log?.error('Database connectivity probe failed with a non-retryable error', {
          host,
          attempt,
          error: errorSummary,
        });
        throw error;
      }

      if (attempt >= maxAttempts) {
        log?.error('Database startup retry budget exhausted', {
          host,
          attempt,
          maxAttempts,
          error: errorSummary,
        });
        throw error;
      }

      const delayMs = getDatabaseStartupRetryDelayMs(attempt, baseDelayMs, maxDelayMs);

      log?.warn('Database connectivity probe failed during startup; retrying', {
        host,
        attempt,
        maxAttempts,
        delayMs,
        error: errorSummary,
      });

      await sleep(delayMs);
    }
  }
}
