/// <reference types="bun" />

import { basename, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  BUILD_ENV_DEFAULTS,
  resolvePublicEnvInput,
  resolveServerEnvInput,
} from '../src/lib/build-env-defaults';

const NEXT_PRODUCTION_BUILD_PHASE = 'phase-production-build';

export { BUILD_ENV_DEFAULTS };

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

if (import.meta.main) {
  const { env } = resolveProductionBuildEnv(process.env);

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const buildCommand = resolveProductionBuildCommand();

  // Drive the Bun/Next CLI path directly through Bun's own subprocess API.
  // Spawning a Bun child via node:child_process from a Bun-launched wrapper
  // can crash on Windows even when `bun --bun next build` succeeds directly.
  try {
    const buildProcess = Bun.spawnSync([...buildCommand], {
      cwd: packageRoot,
      env,
      stdout: 'inherit',
      stderr: 'inherit',
    });

    process.exit(buildProcess.exitCode);
  } catch (error) {
    console.error('[build-production] Build failed:', error);
    process.exit(1);
  }
}
