import { spawn } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

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

if (import.meta.main) {
  const { env, overriddenKeys } = resolveProductionBuildEnv(process.env);

  if (overriddenKeys.length > 0) {
    console.warn(`[build-production] Using smoke-build defaults for: ${overriddenKeys.join(', ')}`);
  }

  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
  const buildExitCode = await new Promise<number>((resolveCode, reject) => {
    const child = spawn(process.execPath, ['--bun', 'next', 'build', '--webpack'], {
      cwd: packageRoot,
      env,
      stdio: 'inherit',
    });

    child.on('error', reject);
    child.on('exit', (code) => resolveCode(code ?? 1));
  });

  process.exit(buildExitCode);
}
