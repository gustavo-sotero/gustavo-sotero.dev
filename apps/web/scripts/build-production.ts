import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

export type ProductionBuildRuntime = 'bun' | 'node';

type ProductionBuildCommand = {
  args: string[];
  command: string;
  runtime: ProductionBuildRuntime;
};

export const BUILD_ENV_DEFAULTS = {
  NEXT_PUBLIC_API_URL: 'https://api.example.invalid',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'build-only-turnstile-site-key',
  NEXT_PUBLIC_S3_PUBLIC_DOMAIN: 'https://media.example.invalid',
  REVALIDATE_SECRET: 'build-only-revalidate-secret',
} as const;

function isValidHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export function resolveProductionBuildEnv(source: NodeJS.ProcessEnv): {
  env: NodeJS.ProcessEnv;
  overriddenKeys: string[];
} {
  const env: NodeJS.ProcessEnv = { ...source, NODE_ENV: 'production' };
  const overriddenKeys: string[] = [];

  if (!isValidHttpsUrl(env.NEXT_PUBLIC_API_URL)) {
    env.NEXT_PUBLIC_API_URL = BUILD_ENV_DEFAULTS.NEXT_PUBLIC_API_URL;
    overriddenKeys.push('NEXT_PUBLIC_API_URL');
  }

  if (!env.NEXT_PUBLIC_TURNSTILE_SITE_KEY) {
    env.NEXT_PUBLIC_TURNSTILE_SITE_KEY = BUILD_ENV_DEFAULTS.NEXT_PUBLIC_TURNSTILE_SITE_KEY;
    overriddenKeys.push('NEXT_PUBLIC_TURNSTILE_SITE_KEY');
  }

  if (!isValidHttpsUrl(env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN)) {
    env.NEXT_PUBLIC_S3_PUBLIC_DOMAIN = BUILD_ENV_DEFAULTS.NEXT_PUBLIC_S3_PUBLIC_DOMAIN;
    overriddenKeys.push('NEXT_PUBLIC_S3_PUBLIC_DOMAIN');
  }

  if (!env.REVALIDATE_SECRET) {
    env.REVALIDATE_SECRET = BUILD_ENV_DEFAULTS.REVALIDATE_SECRET;
    overriddenKeys.push('REVALIDATE_SECRET');
  }

  return { env, overriddenKeys };
}

export function resolveProductionBuildRuntime(
  source: NodeJS.ProcessEnv,
  platform: NodeJS.Platform = process.platform
): ProductionBuildRuntime {
  const requestedRuntime = source.WEB_NEXT_BUILD_RUNTIME ?? source.WEB_NEXT_RUNTIME;

  if (requestedRuntime === 'bun') return 'bun';
  if (requestedRuntime === 'node') return 'node';
  return platform === 'win32' ? 'node' : 'bun';
}

function getDefaultBunExecutable(): string {
  if (process.versions.bun) return process.execPath;
  return 'bun';
}

function resolveNextCliEntry(packageRoot: string): string {
  const localNextCli = resolve(packageRoot, 'node_modules/next/dist/bin/next');
  if (existsSync(localNextCli)) return localNextCli;
  return resolve(packageRoot, '../../node_modules/next/dist/bin/next');
}

export function getProductionBuildCommand(options: {
  bunExecutable?: string;
  env: NodeJS.ProcessEnv;
  nextCliEntry?: string;
  nodeExecutable?: string;
  packageRoot: string;
  platform?: NodeJS.Platform;
}): ProductionBuildCommand {
  const runtime = resolveProductionBuildRuntime(options.env, options.platform);

  if (runtime === 'node') {
    return {
      args: [options.nextCliEntry ?? resolveNextCliEntry(options.packageRoot), 'build'],
      command: options.nodeExecutable ?? 'node',
      runtime,
    };
  }

  return {
    args: ['--bun', 'next', 'build'],
    command: options.bunExecutable ?? getDefaultBunExecutable(),
    runtime,
  };
}

if (import.meta.main) {
  const { env, overriddenKeys } = resolveProductionBuildEnv(process.env);

  if (overriddenKeys.length > 0) {
    console.warn(`[build-production] Using smoke-build defaults for: ${overriddenKeys.join(', ')}`);
  }

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const buildCommand = getProductionBuildCommand({ env, packageRoot });

  if (buildCommand.runtime === 'node') {
    console.warn(
      '[build-production] Running `next build` with Node runtime so Windows keeps Turbopack enabled. Override with WEB_NEXT_BUILD_RUNTIME=bun if needed.'
    );
  }

  const buildExitCode = await new Promise<number>((resolveCode, reject) => {
    const child = spawn(buildCommand.command, buildCommand.args, {
      cwd: packageRoot,
      env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => resolveCode(code ?? 1));
  });

  process.exit(buildExitCode);
}
