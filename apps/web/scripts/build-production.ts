/// <reference types="bun" />

import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUILD_ENV_DEFAULTS,
  resolvePublicEnvInput,
  resolveServerEnvInput,
} from '../src/lib/build-env-defaults';

const NEXT_PRODUCTION_BUILD_PHASE = 'phase-production-build';
const TRANSIENT_WINDOWS_BUILD_EXIT_CODES = new Set([1, 3]);

export { BUILD_ENV_DEFAULTS };

interface ProductionBuildResult {
  exitCode: number;
  success: boolean;
  signalCode?: string;
}

export function resolveProductionBuildEnv(source: NodeJS.ProcessEnv): {
  env: NodeJS.ProcessEnv;
  overriddenKeys: string[];
} {
  const buildEnv: NodeJS.ProcessEnv = {
    ...source,
    NODE_ENV: 'production',
    NEXT_PHASE: NEXT_PRODUCTION_BUILD_PHASE,
  };
  const { env: publicEnv, overriddenKeys: publicOverriddenKeys } = resolvePublicEnvInput(buildEnv);
  const { env: serverEnv, overriddenKeys: serverOverriddenKeys } = resolveServerEnvInput(buildEnv);

  return {
    env: {
      ...buildEnv,
      ...publicEnv,
      ...serverEnv,
    },
    overriddenKeys: [...publicOverriddenKeys, ...serverOverriddenKeys],
  };
}

export function resolveProductionBuildCommand(execPath = process.execPath) {
  const runtimeBinary = /^bun(?:\.exe)?$/i.test(basename(execPath)) ? execPath : 'bun';
  return [runtimeBinary, '--bun', 'next', 'build'] as const;
}

export function resolveProductionBuildMaxAttempts(platform = process.platform): number {
  return platform === 'win32' ? 2 : 1;
}

export function shouldRetryProductionBuild(
  result: ProductionBuildResult,
  attempt: number,
  maxAttempts: number,
  platform = process.platform
): boolean {
  return (
    platform === 'win32' &&
    attempt < maxAttempts &&
    !result.success &&
    result.signalCode === undefined &&
    TRANSIENT_WINDOWS_BUILD_EXIT_CODES.has(result.exitCode)
  );
}

if (import.meta.main) {
  const { env } = resolveProductionBuildEnv(process.env);

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const buildCommand = resolveProductionBuildCommand();
  const maxAttempts = resolveProductionBuildMaxAttempts();

  // Drive the Bun/Next CLI path directly through Bun's own subprocess API.
  // Spawning a Bun child via node:child_process from a Bun-launched wrapper
  // can crash on Windows even when `bun --bun next build` succeeds directly.
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const buildProcess = Bun.spawnSync([...buildCommand], {
        cwd: packageRoot,
        env,
        stdout: 'inherit',
        stderr: 'inherit',
      });

      if (buildProcess.success) {
        process.exit(0);
      }

      if (shouldRetryProductionBuild(buildProcess, attempt, maxAttempts)) {
        console.warn(
          `[build-production] bun --bun next build exited with code ${buildProcess.exitCode} on Windows. Retrying once due to known Bun instability.`
        );
        continue;
      }

      process.exit(buildProcess.exitCode || 1);
    } catch (error) {
      const isRetryableThrow = process.platform === 'win32' && attempt < maxAttempts;

      if (isRetryableThrow) {
        console.warn(
          '[build-production] bun --bun next build threw unexpectedly on Windows. Retrying once due to known Bun instability.'
        );
        continue;
      }

      console.error('[build-production] Build failed:', error);
      process.exit(1);
    }
  }
}
