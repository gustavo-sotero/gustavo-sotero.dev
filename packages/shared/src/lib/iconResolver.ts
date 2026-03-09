/**
 * Icon Resolver — Single source of truth for tag icon assignment.
 *
 * Rules:
 *  1. The system always assigns iconKey — never the user.
 *  2. Resolution order: specific catalog match → category fallback.
 *  3. Both backend (service layer) and frontend (UI catalog) consume this module.
 *  4. The result is ALWAYS non-empty.
 */

import type { TagCategory } from '../constants/enums';

// ── Public Types ──────────────────────────────────────────────────────────────

export interface IconCatalogEntry {
  /** Canonical display name (e.g., "TypeScript") */
  name: string;
  category: TagCategory;
  /** Fully-qualified icon key: "si:SiReact" | "lucide:Database" | etc. */
  iconKey: string;
  /** Alternative spellings for search/resolution matching */
  aliases?: string[];
}

export type IconResolutionSource = 'specific' | 'category_fallback';

export interface ResolvedIcon {
  iconKey: string;
  source: IconResolutionSource;
}

// ── Category Fallback Icons ───────────────────────────────────────────────────

/**
 * These icons are used when no specific catalog entry matches the tag name.
 * Every category MUST have a fallback — never empty.
 */
export const CATEGORY_FALLBACK_ICONS: Readonly<Record<TagCategory, string>> = {
  language: 'lucide:Code2',
  framework: 'lucide:Layers',
  tool: 'lucide:Wrench',
  db: 'lucide:Database',
  cloud: 'lucide:Cloud',
  infra: 'lucide:Server',
  other: 'lucide:Tag',
};

// ── Canonical Catalog (120+ entries) ─────────────────────────────────────────

/**
 * Canonical catalog of technologies → icon keys.
 * This is the authoritative dataset for icon resolution.
 *
 * Naming conventions for iconKey:
 *  - "si:Si<Name>"    → Simple Icons (@icons-pack/react-simple-icons)
 *  - "lucide:<Name>"  → Lucide React (lucide-react)
 */
export const ICON_CATALOG: Readonly<IconCatalogEntry[]> = [
  // ── Languages ─────────────────────────────────────────────────────────────
  {
    name: 'TypeScript',
    category: 'language',
    iconKey: 'si:SiTypescript',
    aliases: ['ts', 'typescript'],
  },
  {
    name: 'JavaScript',
    category: 'language',
    iconKey: 'si:SiJavascript',
    aliases: ['js', 'ecmascript', 'es6', 'es2015'],
  },
  {
    name: 'Node.js',
    category: 'language',
    iconKey: 'si:SiNodedotjs',
    aliases: ['node', 'nodejs', 'node js'],
  },
  {
    name: 'Python',
    category: 'language',
    iconKey: 'si:SiPython',
    aliases: ['py', 'python3'],
  },
  {
    name: 'PHP',
    category: 'language',
    iconKey: 'si:SiPhp',
    aliases: ['php8', 'php7'],
  },
  {
    name: 'Java',
    category: 'language',
    iconKey: 'lucide:Code2',
    aliases: ['java se', 'java ee', 'jdk'],
  },
  {
    name: 'Rust',
    category: 'language',
    iconKey: 'si:SiRust',
    aliases: ['rust lang'],
  },
  {
    name: 'Go',
    category: 'language',
    iconKey: 'si:SiGo',
    aliases: ['golang', 'go lang'],
  },
  {
    name: 'Ruby',
    category: 'language',
    iconKey: 'si:SiRuby',
    aliases: ['rb', 'ruby on rails lang'],
  },
  {
    name: 'Swift',
    category: 'language',
    iconKey: 'si:SiSwift',
    aliases: ['swift lang', 'ios lang'],
  },
  {
    name: 'Kotlin',
    category: 'language',
    iconKey: 'si:SiKotlin',
    aliases: ['kotlin lang', 'android lang'],
  },
  {
    name: 'C#',
    category: 'language',
    iconKey: 'si:SiSharp',
    aliases: ['csharp', 'c sharp', 'dotnet', '.net', 'cs'],
  },
  {
    name: 'Dart',
    category: 'language',
    iconKey: 'si:SiDart',
    aliases: ['dart lang', 'flutter lang'],
  },
  {
    name: 'Elixir',
    category: 'language',
    iconKey: 'si:SiElixir',
    aliases: ['elixir lang'],
  },
  {
    name: 'Scala',
    category: 'language',
    iconKey: 'si:SiScala',
    aliases: ['scala lang'],
  },
  {
    name: 'HTML',
    category: 'language',
    iconKey: 'si:SiHtml5',
    aliases: ['html5', 'html 5', 'markup'],
  },
  {
    name: 'CSS',
    category: 'language',
    iconKey: 'lucide:Code2',
    aliases: ['css3', 'css 3', 'stylesheet'],
  },
  {
    name: 'Bash',
    category: 'language',
    iconKey: 'lucide:Terminal',
    aliases: ['shell', 'sh', 'zsh', 'fish', 'bash script', 'shell script'],
  },
  {
    name: 'SQL',
    category: 'language',
    iconKey: 'lucide:Database',
    aliases: ['plsql', 'tsql', 'pl/sql', 't-sql', 'ansi sql'],
  },
  {
    name: 'R',
    category: 'language',
    iconKey: 'lucide:Code2',
    aliases: ['r lang', 'r language', 'rstats'],
  },
  {
    name: 'C++',
    category: 'language',
    iconKey: 'lucide:Code2',
    aliases: ['cpp', 'c plus plus'],
  },
  {
    name: 'C',
    category: 'language',
    iconKey: 'lucide:Code2',
    aliases: ['c lang', 'c language', 'ansi c'],
  },
  {
    name: 'Lua',
    category: 'language',
    iconKey: 'si:SiLua',
    aliases: ['lua lang'],
  },
  {
    name: 'Erlang',
    category: 'language',
    iconKey: 'lucide:Code2',
    aliases: ['erlang lang'],
  },
  {
    name: 'Haskell',
    category: 'language',
    iconKey: 'si:SiHaskell',
    aliases: ['haskell lang'],
  },

  // ── Frameworks & Libraries ─────────────────────────────────────────────────
  {
    name: 'React',
    category: 'framework',
    iconKey: 'si:SiReact',
    aliases: ['react.js', 'reactjs'],
  },
  {
    name: 'Next.js',
    category: 'framework',
    iconKey: 'si:SiNextdotjs',
    aliases: ['nextjs', 'next', 'next js'],
  },
  {
    name: 'Vue',
    category: 'framework',
    iconKey: 'si:SiVuedotjs',
    aliases: ['vue.js', 'vuejs', 'vue 3', 'vue 2'],
  },
  {
    name: 'Nuxt',
    category: 'framework',
    iconKey: 'si:SiNuxt',
    aliases: ['nuxt.js', 'nuxtjs', 'nuxt3', 'nuxt 3'],
  },
  {
    name: 'Angular',
    category: 'framework',
    iconKey: 'si:SiAngular',
    aliases: ['angularjs', 'angular.js', 'ng'],
  },
  {
    name: 'Svelte',
    category: 'framework',
    iconKey: 'si:SiSvelte',
    aliases: ['svelte.js', 'sveltejs'],
  },
  {
    name: 'SvelteKit',
    category: 'framework',
    iconKey: 'si:SiSvelte',
    aliases: ['svelte kit', 'sveltekit framework'],
  },
  {
    name: 'Hono',
    category: 'framework',
    iconKey: 'si:SiHono',
    aliases: ['hono.dev'],
  },
  {
    name: 'Express',
    category: 'framework',
    iconKey: 'si:SiExpress',
    aliases: ['express.js', 'expressjs'],
  },
  {
    name: 'NestJS',
    category: 'framework',
    iconKey: 'si:SiNestjs',
    aliases: ['nest', 'nest.js'],
  },
  {
    name: 'Fastify',
    category: 'framework',
    iconKey: 'si:SiFastify',
    aliases: ['fastify.io'],
  },
  {
    name: 'Django',
    category: 'framework',
    iconKey: 'si:SiDjango',
    aliases: ['django framework'],
  },
  {
    name: 'FastAPI',
    category: 'framework',
    iconKey: 'si:SiFastapi',
    aliases: ['fast api', 'fastapi framework'],
  },
  {
    name: 'Flask',
    category: 'framework',
    iconKey: 'si:SiFlask',
    aliases: ['flask python', 'flask app'],
  },
  {
    name: 'Laravel',
    category: 'framework',
    iconKey: 'si:SiLaravel',
    aliases: ['laravel php'],
  },
  {
    name: 'Spring Boot',
    category: 'framework',
    iconKey: 'si:SiSpringboot',
    aliases: ['spring', 'spring framework', 'springboot'],
  },
  {
    name: 'Tailwind CSS',
    category: 'framework',
    iconKey: 'si:SiTailwindcss',
    aliases: ['tailwind', 'tailwindcss'],
  },
  {
    name: 'tRPC',
    category: 'framework',
    iconKey: 'si:SiTrpc',
    aliases: ['trpc', 'typerouter'],
  },
  {
    name: 'Astro',
    category: 'framework',
    iconKey: 'si:SiAstro',
    aliases: ['astro.build', 'astrojs'],
  },
  {
    name: 'Remix',
    category: 'framework',
    iconKey: 'si:SiRemix',
    aliases: ['remix.run', 'remixjs', 'remix js'],
  },
  {
    name: 'SolidJS',
    category: 'framework',
    iconKey: 'si:SiSolid',
    aliases: ['solid.js', 'solidjs', 'solid'],
  },
  {
    name: 'Expo',
    category: 'framework',
    iconKey: 'si:SiExpo',
    aliases: ['expo go', 'expo react native'],
  },
  {
    name: 'React Native',
    category: 'framework',
    iconKey: 'si:SiReact',
    aliases: ['rn', 'react-native', 'react native mobile'],
  },
  {
    name: 'Storybook',
    category: 'framework',
    iconKey: 'si:SiStorybook',
    aliases: ['story book', 'storybook.js'],
  },
  {
    name: 'shadcn/ui',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['shadcn', 'shadcnui', 'shadcn ui'],
  },
  {
    name: 'Radix UI',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['radix', 'radixui'],
  },
  {
    name: 'Ionic',
    category: 'framework',
    iconKey: 'si:SiIonic',
    aliases: ['ionic framework', 'ionic capacitor'],
  },
  {
    name: 'Fiber',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['gofiber', 'go fiber'],
  },
  {
    name: 'Elysia',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['elysia.js', 'elysiajs'],
  },
  {
    name: 'AdonisJS',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['adonis', 'adonis.js'],
  },
  {
    name: 'Ruby on Rails',
    category: 'framework',
    iconKey: 'si:SiRubyonrails',
    aliases: ['rails', 'ror', 'ruby rails'],
  },
  {
    name: 'Three.js',
    category: 'framework',
    iconKey: 'si:SiThreedotjs',
    aliases: ['three', 'threejs', '3d web'],
  },
  {
    name: 'Zod',
    category: 'framework',
    iconKey: 'lucide:Shield',
    aliases: ['zod validation', 'zod schema'],
  },

  // ── Tools ─────────────────────────────────────────────────────────────────
  {
    name: 'Docker',
    category: 'tool',
    iconKey: 'si:SiDocker',
    aliases: ['docker container'],
  },
  {
    name: 'Git',
    category: 'tool',
    iconKey: 'si:SiGit',
    aliases: ['version control', 'vcs'],
  },
  {
    name: 'Bun',
    category: 'tool',
    iconKey: 'si:SiBun',
    aliases: ['bun runtime', 'bun.sh'],
  },
  {
    name: 'Vite',
    category: 'tool',
    iconKey: 'si:SiVite',
    aliases: ['vite build', 'vitejs'],
  },
  {
    name: 'Webpack',
    category: 'tool',
    iconKey: 'si:SiWebpack',
    aliases: ['webpack bundler'],
  },
  {
    name: 'GitHub Actions',
    category: 'tool',
    iconKey: 'si:SiGithubactions',
    aliases: ['ci/cd', 'cicd', 'github actions', 'github ci', 'gha'],
  },
  {
    name: 'Drizzle ORM',
    category: 'tool',
    iconKey: 'lucide:Database',
    aliases: ['drizzle', 'drizzle-orm'],
  },
  {
    name: 'Prisma',
    category: 'tool',
    iconKey: 'si:SiPrisma',
    aliases: ['prisma orm', 'prisma client'],
  },
  {
    name: 'Vitest',
    category: 'tool',
    iconKey: 'si:SiVitest',
    aliases: ['vitest test'],
  },
  {
    name: 'Playwright',
    category: 'tool',
    iconKey: 'lucide:Terminal',
    aliases: ['playwright test', 'e2e playwright'],
  },
  {
    name: 'pnpm',
    category: 'tool',
    iconKey: 'si:SiPnpm',
    aliases: ['pnpm package manager'],
  },
  {
    name: 'npm',
    category: 'tool',
    iconKey: 'si:SiNpm',
    aliases: ['npm registry', 'node package manager'],
  },
  {
    name: 'Yarn',
    category: 'tool',
    iconKey: 'si:SiYarn',
    aliases: ['yarn pkg', 'yarn berry'],
  },
  {
    name: 'GraphQL',
    category: 'tool',
    iconKey: 'si:SiGraphql',
    aliases: ['gql', 'graphql api', 'graphql schema'],
  },
  {
    name: 'BullMQ',
    category: 'tool',
    iconKey: 'lucide:Zap',
    aliases: ['bull', 'queue', 'bullmq queue'],
  },
  {
    name: 'ESLint',
    category: 'tool',
    iconKey: 'si:SiEslint',
    aliases: ['eslint linter'],
  },
  {
    name: 'Prettier',
    category: 'tool',
    iconKey: 'si:SiPrettier',
    aliases: ['prettier formatter', 'code formatter'],
  },
  {
    name: 'Jest',
    category: 'tool',
    iconKey: 'si:SiJest',
    aliases: ['jest test', 'jest framework'],
  },
  {
    name: 'Cypress',
    category: 'tool',
    iconKey: 'si:SiCypress',
    aliases: ['cypress e2e', 'cypress test'],
  },
  {
    name: 'Deno',
    category: 'tool',
    iconKey: 'si:SiDeno',
    aliases: ['deno runtime', 'deno.land'],
  },
  {
    name: 'GitHub',
    category: 'tool',
    iconKey: 'si:SiGithub',
    aliases: ['github.com', 'gh'],
  },
  {
    name: 'GitLab',
    category: 'tool',
    iconKey: 'si:SiGitlab',
    aliases: ['gitlab.com', 'gitlab ci'],
  },
  {
    name: 'Postman',
    category: 'tool',
    iconKey: 'si:SiPostman',
    aliases: ['api testing', 'api client'],
  },
  {
    name: 'Turborepo',
    category: 'tool',
    iconKey: 'lucide:Zap',
    aliases: ['turbo repo', 'turbo'],
  },
  {
    name: 'Biome',
    category: 'tool',
    iconKey: 'lucide:Code2',
    aliases: ['biomejs', 'biome linter'],
  },
  {
    name: 'Babel',
    category: 'tool',
    iconKey: 'si:SiBabel',
    aliases: ['babel.js', 'babeljs', 'transpiler'],
  },
  {
    name: 'TanStack Query',
    category: 'tool',
    iconKey: 'lucide:Server',
    aliases: ['react query', 'tanstack', 'tanstack-query', 'react-query'],
  },
  {
    name: 'OpenAPI',
    category: 'tool',
    iconKey: 'lucide:FileText',
    aliases: ['swagger', 'openapi spec', 'swagger ui', 'openapi 3'],
  },
  {
    name: 'Nx',
    category: 'tool',
    iconKey: 'si:SiNx',
    aliases: ['nx build system', 'nx monorepo'],
  },

  // ── Databases ─────────────────────────────────────────────────────────────
  {
    name: 'PostgreSQL',
    category: 'db',
    iconKey: 'si:SiPostgresql',
    aliases: ['postgres', 'pg', 'postgresql db'],
  },
  {
    name: 'MySQL',
    category: 'db',
    iconKey: 'si:SiMysql',
    aliases: ['mysql db'],
  },
  {
    name: 'MongoDB',
    category: 'db',
    iconKey: 'si:SiMongodb',
    aliases: ['mongo', 'mongodb atlas'],
  },
  {
    name: 'Redis',
    category: 'db',
    iconKey: 'si:SiRedis',
    aliases: ['redis cache', 'redis db'],
  },
  {
    name: 'SQLite',
    category: 'db',
    iconKey: 'si:SiSqlite',
    aliases: ['sqlite3'],
  },
  {
    name: 'Supabase',
    category: 'db',
    iconKey: 'si:SiSupabase',
    aliases: ['supabase db'],
  },
  {
    name: 'PlanetScale',
    category: 'db',
    iconKey: 'lucide:Database',
    aliases: ['planet scale'],
  },
  {
    name: 'Elasticsearch',
    category: 'db',
    iconKey: 'si:SiElasticsearch',
    aliases: ['elastic', 'opensearch', 'elastic search'],
  },
  {
    name: 'MariaDB',
    category: 'db',
    iconKey: 'si:SiMariadb',
    aliases: ['maria db'],
  },
  {
    name: 'CockroachDB',
    category: 'db',
    iconKey: 'lucide:Database',
    aliases: ['cockroach', 'cockroach db'],
  },
  {
    name: 'DynamoDB',
    category: 'db',
    iconKey: 'lucide:Database',
    aliases: ['dynamo', 'dynamo db', 'aws dynamodb'],
  },
  {
    name: 'Cassandra',
    category: 'db',
    iconKey: 'lucide:Database',
    aliases: ['apache cassandra'],
  },
  {
    name: 'Neon',
    category: 'db',
    iconKey: 'lucide:Database',
    aliases: ['neon db', 'neon serverless'],
  },
  {
    name: 'Turso',
    category: 'db',
    iconKey: 'lucide:Database',
    aliases: ['turso db', 'libsql'],
  },

  // ── Cloud ─────────────────────────────────────────────────────────────────
  {
    name: 'AWS',
    category: 'cloud',
    iconKey: 'lucide:Cloud',
    aliases: ['amazon', 'amazon web services', 'amazon aws'],
  },
  {
    name: 'GCP',
    category: 'cloud',
    iconKey: 'si:SiGooglecloud',
    aliases: ['google cloud', 'google cloud platform', 'google gcp'],
  },
  {
    name: 'Azure',
    category: 'cloud',
    iconKey: 'lucide:Cloud',
    aliases: ['microsoft azure', 'ms azure'],
  },
  {
    name: 'Vercel',
    category: 'cloud',
    iconKey: 'si:SiVercel',
    aliases: ['vercel.com'],
  },
  {
    name: 'Netlify',
    category: 'cloud',
    iconKey: 'si:SiNetlify',
    aliases: ['netlify.com'],
  },
  {
    name: 'Cloudflare',
    category: 'cloud',
    iconKey: 'si:SiCloudflare',
    aliases: ['cf', 'cloudflare workers', 'cloudflare pages'],
  },
  {
    name: 'DigitalOcean',
    category: 'cloud',
    iconKey: 'si:SiDigitalocean',
    aliases: ['digital ocean', 'do', 'digitalocean droplets'],
  },
  {
    name: 'Heroku',
    category: 'cloud',
    iconKey: 'lucide:Cloud',
    aliases: ['heroku app'],
  },
  {
    name: 'Railway',
    category: 'cloud',
    iconKey: 'lucide:Cloud',
    aliases: ['railway.app'],
  },
  {
    name: 'Fly.io',
    category: 'cloud',
    iconKey: 'lucide:Cloud',
    aliases: ['fly', 'flyio'],
  },
  {
    name: 'Render',
    category: 'cloud',
    iconKey: 'lucide:Cloud',
    aliases: ['render.com'],
  },
  {
    name: 'Hetzner',
    category: 'cloud',
    iconKey: 'lucide:Cloud',
    aliases: ['hetzner cloud', 'hetzner vps'],
  },
  {
    name: 'Linode',
    category: 'cloud',
    iconKey: 'lucide:Cloud',
    aliases: ['akamai cloud', 'linode vps'],
  },

  // ── Infra ─────────────────────────────────────────────────────────────────
  {
    name: 'Docker Compose',
    category: 'infra',
    iconKey: 'si:SiDocker',
    aliases: ['compose', 'docker-compose', 'docker compose'],
  },
  {
    name: 'Kubernetes',
    category: 'infra',
    iconKey: 'si:SiKubernetes',
    aliases: ['k8s', 'kube'],
  },
  {
    name: 'Terraform',
    category: 'infra',
    iconKey: 'si:SiTerraform',
    aliases: ['tf', 'opentofu', 'hcl'],
  },
  {
    name: 'Nginx',
    category: 'infra',
    iconKey: 'si:SiNginx',
    aliases: ['nginx server', 'nginx proxy'],
  },
  {
    name: 'Linux',
    category: 'infra',
    iconKey: 'si:SiLinux',
    aliases: ['ubuntu', 'debian', 'centos', 'fedora', 'unix'],
  },
  {
    name: 'Traefik',
    category: 'infra',
    iconKey: 'si:SiTraefikproxy',
    aliases: ['traefik proxy'],
  },
  {
    name: 'Prometheus',
    category: 'infra',
    iconKey: 'si:SiPrometheus',
    aliases: ['metrics', 'prometheus monitoring'],
  },
  {
    name: 'Grafana',
    category: 'infra',
    iconKey: 'si:SiGrafana',
    aliases: ['grafana dashboard'],
  },
  {
    name: 'Ansible',
    category: 'infra',
    iconKey: 'si:SiAnsible',
    aliases: ['ansible playbook'],
  },
  {
    name: 'Helm',
    category: 'infra',
    iconKey: 'lucide:Server',
    aliases: ['helm chart', 'k8s helm'],
  },
  {
    name: 'MinIO',
    category: 'infra',
    iconKey: 'lucide:Database',
    aliases: ['minio storage', 's3 compatible'],
  },
  {
    name: 'Dokploy',
    category: 'infra',
    iconKey: 'lucide:Server',
    aliases: ['dokploy deploy'],
  },
  {
    name: 'PM2',
    category: 'infra',
    iconKey: 'lucide:Server',
    aliases: ['pm2 process manager', 'process manager'],
  },
  {
    name: 'Jenkins',
    category: 'infra',
    iconKey: 'si:SiJenkins',
    aliases: ['jenkins ci', 'jenkins cd'],
  },
  {
    name: 'Podman',
    category: 'infra',
    iconKey: 'lucide:Container',
    aliases: ['podman container'],
  },
  {
    name: 'Apache',
    category: 'infra',
    iconKey: 'si:SiApache',
    aliases: ['apache httpd', 'apache server'],
  },

  // ── Additional Frameworks ──────────────────────────────────────────────────
  {
    name: 'HTMX',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['htmx.org', 'hypermedia'],
  },
  {
    name: 'Alpine.js',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['alpine', 'alpinejs', 'alpine js'],
  },
  {
    name: 'Redux',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['redux store', 'redux toolkit', 'rtk'],
  },
  {
    name: 'Zustand',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['zustand store'],
  },
  {
    name: 'Jotai',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['jotai atoms'],
  },
  {
    name: 'MobX',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['mobx state', 'mobx store'],
  },
  {
    name: 'React Router',
    category: 'framework',
    iconKey: 'lucide:Layers',
    aliases: ['react-router', 'react router dom', 'tanstack router'],
  },
  {
    name: 'Pinia',
    category: 'framework',
    iconKey: 'si:SiVuedotjs',
    aliases: ['vue pinia', 'pinia store'],
  },

  // ── Observability, Monitoring & Load Testing ───────────────────────────────
  {
    name: 'Sentry',
    category: 'tool',
    iconKey: 'lucide:Shield',
    aliases: ['sentry.io', 'error tracking', 'error monitoring'],
  },
  {
    name: 'OpenTelemetry',
    category: 'tool',
    iconKey: 'lucide:Server',
    aliases: ['otel', 'opentelemetry observability', 'otelcol'],
  },
  {
    name: 'k6',
    category: 'tool',
    iconKey: 'lucide:Zap',
    aliases: ['k6.io', 'grafana k6'],
  },
  {
    name: 'Artillery',
    category: 'tool',
    iconKey: 'lucide:Zap',
    aliases: ['artillery.io', 'artillery load test'],
  },
  {
    name: 'LogTape',
    category: 'tool',
    iconKey: 'lucide:FileText',
    aliases: ['logtape logger', 'structured logging'],
  },
  {
    name: 'RabbitMQ',
    category: 'tool',
    iconKey: 'lucide:Zap',
    aliases: ['rabbitmq broker', 'amqp', 'message broker'],
  },
  {
    name: 'Apache Kafka',
    category: 'tool',
    iconKey: 'lucide:Zap',
    aliases: ['kafka', 'kafka streams', 'kafka broker'],
  },
  {
    name: 'Socket.IO',
    category: 'tool',
    iconKey: 'lucide:Zap',
    aliases: ['socketio', 'socket io', 'websocket io'],
  },
  {
    name: 'Stripe',
    category: 'tool',
    iconKey: 'lucide:Tag',
    aliases: ['stripe api', 'stripe payments'],
  },
  {
    name: 'Cloudinary',
    category: 'tool',
    iconKey: 'lucide:Layers',
    aliases: ['cloudinary cdn', 'cloudinary image'],
  },

  // ── Additional Databases & Search ─────────────────────────────────────────
  {
    name: 'Meilisearch',
    category: 'db',
    iconKey: 'lucide:Database',
    aliases: ['meilisearch engine', 'meili'],
  },
  {
    name: 'Upstash',
    category: 'db',
    iconKey: 'lucide:Database',
    aliases: ['upstash redis', 'serverless redis'],
  },
  {
    name: 'FaunaDB',
    category: 'db',
    iconKey: 'lucide:Database',
    aliases: ['fauna', 'fauna serverless'],
  },
  {
    name: 'ClickHouse',
    category: 'db',
    iconKey: 'lucide:Database',
    aliases: ['clickhouse db', 'olap db'],
  },

  // ── Additional Infra & Monitoring ──────────────────────────────────────────
  {
    name: 'Datadog',
    category: 'infra',
    iconKey: 'lucide:Server',
    aliases: ['datadog monitoring', 'datadog apm'],
  },
  {
    name: 'New Relic',
    category: 'infra',
    iconKey: 'lucide:Server',
    aliases: ['newrelic', 'new relic apm'],
  },
] as const satisfies IconCatalogEntry[];

// ── Internal Lookup Maps (built once at module load) ──────────────────────────

/**
 * Normalizes a tag name for deterministic comparison.
 *
 * Algorithm:
 *  1. NFD normalize (split accented chars)
 *  2. Remove combining diacritics (accent marks)
 *  3. Lowercase
 *  4. Replace common separators (spaces, underscores, hyphens) with single space
 *  5. Collapse any remaining whitespace
 *  6. Trim
 */
export function normalizeTagName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[_-]+/g, ' ') // separators → space
    .replace(/\s+/g, ' ') // collapse whitespace
    .trim();
}

function isValidIconKey(iconKey: string): boolean {
  return iconKey.startsWith('si:') || iconKey.startsWith('lucide:');
}

function assertIconCatalogInvariants(): void {
  const validCategories = new Set(Object.keys(CATEGORY_FALLBACK_ICONS));
  const seenLookupKeys = new Map<string, string>();

  for (const entry of ICON_CATALOG) {
    const canonicalName = entry.name.trim();
    if (!canonicalName) {
      throw new Error('Invalid ICON_CATALOG entry: name must be non-empty');
    }

    if (!validCategories.has(entry.category)) {
      throw new Error(
        `Invalid ICON_CATALOG entry "${entry.name}": unknown category "${entry.category}"`
      );
    }

    const iconKey = entry.iconKey.trim();
    if (!iconKey || !isValidIconKey(iconKey)) {
      throw new Error(
        `Invalid ICON_CATALOG entry "${entry.name}": iconKey "${entry.iconKey}" must start with "si:" or "lucide:"`
      );
    }

    const normalizedTargets = [entry.name, ...(entry.aliases ?? [])].map((item) => {
      const value = item.trim();
      if (!value) {
        throw new Error(`Invalid ICON_CATALOG entry "${entry.name}": empty alias is not allowed`);
      }
      return normalizeTagName(value);
    });

    for (const normalized of new Set(normalizedTargets)) {
      const owner = seenLookupKeys.get(normalized);
      if (owner && owner !== entry.name) {
        throw new Error(
          `Invalid ICON_CATALOG: lookup key "${normalized}" is duplicated between "${owner}" and "${entry.name}"`
        );
      }
      if (!owner) {
        seenLookupKeys.set(normalized, entry.name);
      }
    }
  }
}

assertIconCatalogInvariants();

// Build lookup maps: normalizedName → iconKey AND normalizedName → full entry
const _iconMap = new Map<string, string>();
const _entryMap = new Map<string, IconCatalogEntry>();

for (const entry of ICON_CATALOG) {
  const norm = normalizeTagName(entry.name);
  if (!_iconMap.has(norm)) {
    _iconMap.set(norm, entry.iconKey);
    _entryMap.set(norm, entry);
  }
  for (const alias of entry.aliases ?? []) {
    const normAlias = normalizeTagName(alias);
    if (!_iconMap.has(normAlias)) {
      _iconMap.set(normAlias, entry.iconKey);
      _entryMap.set(normAlias, entry);
    }
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Resolves the appropriate icon key for a tag.
 *
 * 1. Normalizes name and tries to find a specific catalog match.
 * 2. Falls back to the category default icon if no match found.
 * 3. Always returns a non-empty iconKey.
 *
 * @param name     - Tag display name (any casing/spacing)
 * @param category - Tag category (used for fallback resolution)
 * @returns `{ iconKey, source }` where source indicates how the icon was resolved
 */
export function resolveTagIcon(name: string, category: TagCategory): ResolvedIcon {
  const norm = normalizeTagName(name);
  const specific = _iconMap.get(norm);

  if (specific) {
    return { iconKey: specific, source: 'specific' };
  }

  // Safe fallback: category default (always non-empty)
  const effectiveCategory: TagCategory = Object.keys(CATEGORY_FALLBACK_ICONS).includes(category)
    ? category
    : 'other';

  return {
    iconKey: CATEGORY_FALLBACK_ICONS[effectiveCategory],
    source: 'category_fallback',
  };
}

/**
 * Resolves the full catalog entry for a given tag name or alias.
 *
 * Returns the matching `IconCatalogEntry` when a specific catalog entry exists,
 * or `null` when the name is unmapped. This is used by the frontend to detect
 * whether a tag is "predefined" (mapped) and auto-populate its category.
 *
 * @param name - Tag name or alias to look up (any casing/spacing)
 */
export function resolveCatalogEntry(name: string): IconCatalogEntry | null {
  const norm = normalizeTagName(name);
  return _entryMap.get(norm) ?? null;
}

/**
 * All catalog entries filtered by a specific category.
 * Useful for frontend suggestion panels.
 */
export function getCatalogByCategory(category: TagCategory): IconCatalogEntry[] {
  return ICON_CATALOG.filter((e) => e.category === category);
}
