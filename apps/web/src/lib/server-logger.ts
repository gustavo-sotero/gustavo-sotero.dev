type LogContext = Record<string, unknown>;

function normalizeContext(context?: LogContext): LogContext | undefined {
  if (!context || Object.keys(context).length === 0) return undefined;
  return context;
}

/**
 * Minimal structured logging helper for server runtime paths
 * (Server Components, Route Handlers, and Server Actions).
 */
export function logServerError(scope: string, message: string, context?: LogContext): void {
  const normalized = normalizeContext(context);
  if (normalized) {
    console.error(`[${scope}] ${message}`, normalized);
    return;
  }

  console.error(`[${scope}] ${message}`);
}
