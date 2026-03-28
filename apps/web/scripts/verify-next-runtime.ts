type NextStartServerModule = {
  getRequestHandlers?: unknown;
  startServer?: unknown;
};

export function getInvalidNextRuntimeMessage(): string {
  return [
    '[next-runtime] Invalid Next.js runtime installation detected.',
    '[next-runtime] The module `next/dist/server/lib/start-server` is missing the expected exports `startServer` and/or `getRequestHandlers`.',
    '[next-runtime] In this workspace, the most likely cause is Console Ninja auto-enabling Next.js support and truncating that file while injecting its build hook.',
    '[next-runtime] The workspace now disables that integration via `.vscode/settings.json`.',
    '[next-runtime] Reload VS Code so the new workspace setting is applied, then repair the install with:',
    '[next-runtime]   bun install --force --filter @portfolio/web',
  ].join('\n');
}

export function validateNextRuntimeModule(moduleValue: NextStartServerModule): void {
  if (
    typeof moduleValue.startServer === 'function' &&
    typeof moduleValue.getRequestHandlers === 'function'
  ) {
    return;
  }

  throw new Error(getInvalidNextRuntimeMessage());
}

export function loadAndValidateNextRuntime(
  loader: () => NextStartServerModule = () => require('next/dist/server/lib/start-server')
): void {
  validateNextRuntimeModule(loader());
}

if (import.meta.main) {
  try {
    loadAndValidateNextRuntime();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(message);
    process.exit(1);
  }
}
