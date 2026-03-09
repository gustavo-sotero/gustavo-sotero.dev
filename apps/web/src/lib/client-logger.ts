type LogContext = Record<string, unknown>;

function normalizeContext(context?: LogContext): LogContext | undefined {
  if (!context || Object.keys(context).length === 0) return undefined;
  return context;
}

export function logClientError(scope: string, message: string, context?: LogContext): void {
  const normalized = normalizeContext(context);
  if (normalized) {
    console.error(`[${scope}] ${message}`, normalized);
    return;
  }

  console.error(`[${scope}] ${message}`);
}
