# Portfolio — Fullstack Backend-Centric v2.0

Personal portfolio platform built as a **technical proof of concept**: queues, cache, security, CRUD, moderation, direct uploads, image optimization, analytics, and background jobs.

**Stack:** Bun + Hono · Drizzle ORM + PostgreSQL · BullMQ + Redis · Next.js App Router · S3-compatible storage · Docker Compose + Dokploy

---

## Monorepo Structure

```
apps/
  api/      # Hono REST API (Bun)
  worker/   # BullMQ background jobs (Bun)
  web/      # Next.js 16 App Router (React 19, Tailwind 4)
packages/
  shared/   # Shared types, Zod schemas, constants
```

---

## API Route Domains

### Public

| Route domain        | Description                                    |
| ------------------- | ---------------------------------------------- |
| `GET /health`       | Liveness check                                 |
| `GET /ready`        | Readiness check (DB + Redis)                   |
| `/posts`            | Published blog posts                           |
| `/projects`         | Published projects                             |
| `/tags`             | Tags in use across posts/projects              |
| `/comments`         | Anonymous comment submission                   |
| `/contact`          | Contact form submission                        |
| `/developer`        | Developer profile data (bio, availability)     |
| `/experience`       | Professional experience entries                |
| `/education`        | Education entries                              |
| `GET /feed.xml`     | RSS 2.0 feed (published posts)                 |
| `GET /sitemap.xml`  | XML sitemap (public routes + published slugs)  |
| `GET /doc`          | Swagger UI (interactive API docs)              |
| `GET /doc/spec`     | OpenAPI 3.1 spec (JSON)                        |

### Auth

| Route                        | Description                            |
| ---------------------------- | -------------------------------------- |
| `POST /auth/github/start`    | Start GitHub OAuth flow                |
| `GET /auth/github/callback`  | OAuth callback — issues JWT + CSRF     |
| `POST /auth/logout`          | Clear session cookies                  |

### Admin (JWT + CSRF required)

All admin routes are prefixed with `/admin`. Detail GETs use `:slug`; PATCH/DELETE use `:id`.

| Route domain              | Description                               |
| ------------------------- | ----------------------------------------- |
| `/admin/posts`            | CMS — blog posts                          |
| `/admin/projects`         | CMS — projects                            |
| `/admin/tags`             | Tag management                            |
| `/admin/experience`       | Experience entries (admin UI + backend)   |
| `/admin/education`        | Education entries (admin UI + backend)    |
| `/admin/comments`         | Comment moderation (approve/reject)       |
| `/admin/contacts`         | Contact message management                |
| `/admin/uploads`          | Presigned upload + confirm pipeline       |
| `/admin/analytics`        | Pageview summary + top-posts metrics      |
| `/admin/jobs`             | Jobs operational endpoints                |
| `/admin/jobs/dlq`         | DLQ queue counts endpoint (backend only in v1) |

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) ≥ 1.0
- [Docker](https://www.docker.com) + Docker Compose

### Local Setup

The root `.env` file is the single local source of truth for `bun run dev`, `bun run db:*`, API, worker, and web commands.
Keep local secrets in that root file and avoid duplicating them into per-app `.env` files.

```bash
# 1. Install dependencies
bun install

# 2. Copy and fill environment variables
cp .env.example .env
# Edit .env with your values

# 3. Start dev services (PostgreSQL, Redis, MinIO)
docker compose -f docker-compose.dev.yml up -d

# 4. Run database migrations
bun run db:migrate

# 5. Seed sample data
bun run db:seed
```

Windows PowerShell equivalents:

```powershell
Copy-Item .env.example .env
docker compose -f docker-compose.dev.yml up -d
bun run db:migrate
bun run db:seed
```

### Development Servers

```bash
# Start all app processes (requires Docker infra running separately via docker-compose.dev.yml)
bun run dev

# Start individually
bun run dev:api      # API on http://localhost:3000
bun run dev:worker   # Background worker
bun run dev:web      # Web on http://localhost:3001
```

---

## Available Scripts

| Script                  | Description                                 |
| ----------------------- | ------------------------------------------- |
| `bun run dev`           | Start all app processes (api + worker + web) |
| `bun run dev:api`       | API in watch mode                           |
| `bun run dev:worker`    | Worker in watch mode                        |
| `bun run dev:web`       | Next.js dev server                          |
| `bun run db:migrate`    | Apply Drizzle migrations                    |
| `bun run db:seed`       | Seed sample data                            |
| `bun run db:backfill:comments` | Re-render legacy comments to sanitized HTML |
| `bun run db:generate`   | Generate new migrations from schema changes |
| `bun run db:studio`     | Open Drizzle Studio (DB GUI)                |
| `bun run lint`          | Run Biome linter                            |
| `bun run format`        | Format code with Biome                      |
| `bun run check`         | Lint + format with auto-fix                 |
| `bun run test`          | Run all workspace tests                     |
| `bun run test:services` | Start isolated test infrastructure          |

> Use `bun run test`, not `bun test`.
> This monorepo relies on per-workspace Vitest configuration such as `jsdom`, setup files, and module aliases. Running Bun's native test runner directly produces misleading failures like `document is not defined` and unresolved `server-only` imports.

> Migration convention: always generate migrations with `bun run db:generate` from the repository root.

> Drizzle config reads `DATABASE_URL` from the current environment. The root `bun run db:*` scripts already load the same root `.env` contract used by local development.

> Legacy repair step: for existing databases, run `bun run db:backfill:comments` **before** `bun run db:migrate`. The migration now fails fast when `comments.rendered_content` is still null.

### Optional Local Flags

- `RATE_LIMIT_LOCAL_FALLBACK=true` keeps rate limiting available in local development when Redis is temporarily unavailable by using a single-process in-memory fallback.
- Set `RATE_LIMIT_LOCAL_FALLBACK=false` if you want Redis failure to return `503 SERVICE_UNAVAILABLE` instead of falling back locally.

### Web Env Contract (Build vs Runtime)

For `apps/web`, environment variables are split between build-time and runtime concerns:

- Build-time (`docker/web.Dockerfile` ARG/ENV):
  - `NEXT_PUBLIC_API_URL`
  - `NEXT_PUBLIC_TURNSTILE_SITE_KEY`
  - `NEXT_PUBLIC_S3_PUBLIC_DOMAIN`
- Runtime (`docker-compose.yml` web service `environment`):
  - `REVALIDATE_SECRET`
  - `API_INTERNAL_URL` (recommended in Docker: `http://api:3000`)

Server-side API calls resolve base URL with deterministic precedence:

1. `API_INTERNAL_URL` (internal network, preferred)
2. `NEXT_PUBLIC_API_URL` (public fallback)

If neither is valid, the server-side fetch layer fails with an explicit configuration error.

---

## API Health Endpoints

| Endpoint        | Description                         |
| --------------- | ----------------------------------- |
| `GET /health`   | Liveness — process is running       |
| `GET /ready`    | Readiness — DB + Redis connectivity |
| `GET /doc`      | Swagger UI (interactive API docs)   |
| `GET /doc/spec` | OpenAPI 3.1 spec (JSON)             |

### Security note for `/doc`

`/doc` and `/doc/*` use a **route-scoped CSP exception** (Swagger UI requires inline assets and `cdn.jsdelivr.net`).
The stricter global CSP remains active for all other public/admin routes.

---

## Dependency Installation Convention

Always install dependencies **without specifying versions**:

```bash
# Correct
bun add hono
bun add drizzle-orm postgres

# Wrong — never specify version
bun add zod@4      # ❌
bun add hono@latest # ❌
```

The resolved version is locked in `bun.lock` (always committed).

---

## Disaster Recovery

To restore from a backup:

```bash
# 1. Download backup from S3
aws s3 cp s3://your-bucket/backups/YYYY-MM-DD.sql.gz ./

# 2. Decompress
gunzip backup.sql.gz

# 3. Recreate the database
dropdb portfolio && createdb portfolio

# 4. Restore
psql portfolio < backup.sql

# 5. Restart services
docker compose restart

# 6. Verify readiness
curl http://localhost:3000/ready
```

---

## License

MIT License — see [LICENSE](LICENSE) for details.
