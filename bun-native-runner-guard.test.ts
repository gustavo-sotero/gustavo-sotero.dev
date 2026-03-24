if (process.env.BUN_ALLOW_NATIVE_TEST !== '1') {
  const message = [
    '',
    '[test-runner] Unsupported command: `bun test`.',
    '[test-runner] This repository runs tests through workspace Vitest scripts.',
    '[test-runner] Use `bun run test` for the full suite, or `bun run --filter @portfolio/web test` for a single workspace.',
    '[test-runner] Reason: `bun test` bypasses per-workspace Vitest config such as jsdom, setup files, and path aliases.',
    '[test-runner] If you intentionally need Bun\'s native test runner, set `BUN_ALLOW_NATIVE_TEST=1`.',
    '',
  ].join('\n');

  console.error(message);
  process.exit(1);
}

export {};