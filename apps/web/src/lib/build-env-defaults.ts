export const BUILD_ENV_DEFAULTS = {
  NEXT_PUBLIC_API_URL: 'https://api.example.invalid',
  NEXT_PUBLIC_TURNSTILE_SITE_KEY: 'build-only-turnstile-site-key',
  NEXT_PUBLIC_S3_PUBLIC_DOMAIN: 'https://media.example.invalid',
  REVALIDATE_SECRET: 'build-only-revalidate-secret',
} as const;

const NEXT_PRODUCTION_BUILD_PHASE = 'phase-production-build';
const warnedBuildDefaultKeys = new Set<keyof typeof BUILD_ENV_DEFAULTS>();

function isValidHttpsUrl(value: string | undefined): boolean {
  if (!value) return false;

  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

function isNextProductionBuild(source: NodeJS.ProcessEnv): boolean {
  return source.NEXT_PHASE === NEXT_PRODUCTION_BUILD_PHASE;
}

function warnBuildDefaults(overriddenKeys: Array<keyof typeof BUILD_ENV_DEFAULTS>): void {
  const freshKeys = overriddenKeys.filter((key) => !warnedBuildDefaultKeys.has(key));
  if (freshKeys.length === 0) return;

  for (const key of freshKeys) {
    warnedBuildDefaultKeys.add(key);
  }

  console.warn(`[build-env] Using smoke-build defaults for: ${freshKeys.join(', ')}`);
}

export function resolvePublicEnvInput(source: NodeJS.ProcessEnv): {
  env: {
    NEXT_PUBLIC_API_URL: string | undefined;
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: string | undefined;
    NEXT_PUBLIC_S3_PUBLIC_DOMAIN: string | undefined;
  };
  overriddenKeys: Array<keyof Pick<typeof BUILD_ENV_DEFAULTS, 'NEXT_PUBLIC_API_URL' | 'NEXT_PUBLIC_TURNSTILE_SITE_KEY' | 'NEXT_PUBLIC_S3_PUBLIC_DOMAIN'>>;
} {
  const env = {
    NEXT_PUBLIC_API_URL: source.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: source.NEXT_PUBLIC_TURNSTILE_SITE_KEY,
    NEXT_PUBLIC_S3_PUBLIC_DOMAIN: source.NEXT_PUBLIC_S3_PUBLIC_DOMAIN,
  };

  if (!isNextProductionBuild(source)) {
    return { env, overriddenKeys: [] };
  }

  const overriddenKeys: Array<
    keyof Pick<
      typeof BUILD_ENV_DEFAULTS,
      'NEXT_PUBLIC_API_URL' | 'NEXT_PUBLIC_TURNSTILE_SITE_KEY' | 'NEXT_PUBLIC_S3_PUBLIC_DOMAIN'
    >
  > = [];

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

  warnBuildDefaults(overriddenKeys);
  return { env, overriddenKeys };
}

export function resolveServerEnvInput(source: NodeJS.ProcessEnv): {
  env: {
    REVALIDATE_SECRET: string | undefined;
    API_INTERNAL_URL: string | undefined;
  };
  overriddenKeys: Array<keyof Pick<typeof BUILD_ENV_DEFAULTS, 'REVALIDATE_SECRET'>>;
} {
  const env = {
    REVALIDATE_SECRET: source.REVALIDATE_SECRET,
    API_INTERNAL_URL: source.API_INTERNAL_URL,
  };

  if (!isNextProductionBuild(source)) {
    return { env, overriddenKeys: [] };
  }

  const overriddenKeys: Array<keyof Pick<typeof BUILD_ENV_DEFAULTS, 'REVALIDATE_SECRET'>> = [];

  if (!env.REVALIDATE_SECRET) {
    env.REVALIDATE_SECRET = BUILD_ENV_DEFAULTS.REVALIDATE_SECRET;
    overriddenKeys.push('REVALIDATE_SECRET');
  }

  warnBuildDefaults(overriddenKeys);
  return { env, overriddenKeys };
}