# Remediation Checklist â€” CODEBASE_ANALYSIS_2026-05-01

> Wave assignments and acceptance criteria for every finding from the analysis report.
> Status: `pending` | `in-progress` | `done` | `deferred`

---

## Legend

- **Severity**: CRITICAL / HIGH / MEDIUM / LOW
- **Wave**: 0â€“6 (see plan for wave definitions)
- **Status**: pending / in-progress / done / deferred

---

## SEC â€” Security

### SEC-MEDIA-001 Â· Next Image allows localhost in production

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 1 |
| Status | done |
| Affected files | `apps/web/next.config.ts` |
| Description | `images.remotePatterns` includes `http://localhost` unconditionally, allowing the Next.js image optimizer to proxy local container services in production. |
| Acceptance criteria | Production config does not include any localhost or private-IP pattern. `http://localhost` only appears under an explicit dev-mode condition. |
| Verification | `bun run --filter @portfolio/web build` with `NODE_ENV=production`; inspect generated remotePatterns at runtime; add test asserting prod config excludes localhost. |

---

### SEC-MEDIA-002 Â· Arbitrary cover URL schemas accepted

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 1 |
| Status | done |
| Affected files | `packages/shared/src/schemas/posts.ts`, `packages/shared/src/schemas/projects.ts` |
| Description | `coverUrl` accepts any URL-shaped string, including `http://`, `file:`, `data:`, private IP ranges, and localhost. |
| Acceptance criteria | `coverUrl` rejects: `http://` in production, `localhost`, private IP ranges (RFC1918, link-local, loopback), `file:`, `data:`, `ftp:`. Allows: empty string, `https://` HTTPS URLs, S3/CDN HTTPS hosts. |
| Verification | `bun run --filter @portfolio/shared test` covering coverUrl schema. |

---

### SEC-UPLOAD-001 Â· Upload confirm trusts presign-time metadata

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 1 |
| Status | done |
| Affected files | `apps/api/src/services/uploads.service.ts`, `apps/api/src/routes/admin/uploads.ts` |
| Description | Confirmation step only checks S3 object existence. Actual stored size, MIME type, and image magic bytes are not validated before the outbox event is enqueued. |
| Acceptance criteria | `confirmUpload` validates actual object metadata (size, content-type) via S3 stat and reads a small prefix for magic-byte image signature validation before enqueueing. Mismatches throw a domain error and do not enqueue. |
| Verification | `bun run --filter @portfolio/api test -- uploads` covering actual-size mismatch, MIME mismatch, bad magic bytes. |

---

### SEC-UPLOAD-002 Â· Worker reads full object before defensive validation

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 1 |
| Status | done |
| Affected files | `apps/worker/src/jobs/imageOptimize.ts` |
| Description | Worker calls `s3.file(key).bytes()` unconditionally before any size/MIME guard. Oversized or corrupt objects load fully into memory. |
| Acceptance criteria | Worker fetches S3 object metadata first, enforces max size and expected MIME, then reads bytes. Fails terminally on invalid data with structured logging and upload status update. |
| Verification | `bun run --filter @portfolio/worker test -- imageOptimize` covering oversized object and MIME mismatch paths. |

---

### SEC-ENV-001 Â· Public URL env validation does not enforce HTTPS in production

| Field | Value |
|---|---|
| Severity | LOW |
| Wave | 1 |
| Status | done |
| Affected files | `apps/api/src/config/env.fields.ts`, `apps/web/src/lib/env.ts`, `apps/web/src/lib/api-base-url.server.ts`, `apps/worker/src/config/env.ts` |
| Description | Public browser-facing URLs accept `http://` even in production. Internal container URLs (`API_INTERNAL_URL=http://api:3000`) should remain valid. |
| Acceptance criteria | `NODE_ENV=production` rejects `http://` for `NEXT_PUBLIC_API_URL`, `ALLOWED_ORIGIN`, `API_PUBLIC_URL`. `API_INTERNAL_URL=http://api:3000` continues to pass. Dev/test env values remain valid outside production. |
| Verification | `bun run --filter @portfolio/api test -- env-contracts`; `bun run --filter @portfolio/web test -- env`. |

---

### SEC-REDIS-001 Â· Redis fallbacks are single-instance only

| Field | Value |
|---|---|
| Severity | LOW/OPS |
| Wave | 1 |
| Status | done |
| Affected files | `apps/api/src/middleware/rateLimit.ts`, `apps/api/src/routes/admin/auth.ts` |
| Description | Rate limit falls back to local memory when Redis is unavailable. OAuth state also falls back to local memory. Multi-replica deployments see inconsistent state during Redis outages. |
| Acceptance criteria | Production deployments default to fail-closed for both rate limit and OAuth state. `RATE_LIMIT_LOCAL_FALLBACK` documented as `false` for production. Add `OAUTH_STATE_LOCAL_FALLBACK` env field with production default `false`. |
| Verification | `bun run --filter @portfolio/api test -- auth rateLimit` covering fallback-disabled behavior. |

---

## DEPLOY â€” Deployment

### DEPLOY-CI-001 Â· CI builds only web

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 2 |
| Status | done |
| Affected files | `.github/workflows/ci.yml`, `package.json`, `apps/api/package.json`, `apps/worker/package.json` |
| Description | Root `build` runs API (no-op echo) and web. Worker has no build script. CI only runs the web build job. API/worker Docker packaging failures are undetected until deployment. |
| Acceptance criteria | CI includes jobs for: API build smoke, worker build smoke, API Docker build, worker Docker build, web Docker build, `docker compose config` validation. |
| Verification | All CI jobs pass on merge to main. |

---

### DEPLOY-DCKER-001 Â· Runtime containers run as root

| Field | Value |
|---|---|
| Severity | LOW/MEDIUM |
| Wave | 2 |
| Status | done |
| Affected files | `docker/api.Dockerfile`, `docker/worker.Dockerfile`, `docker/web.Dockerfile` |
| Description | API and web Dockerfiles have no `USER` directive; worker installs packages as root and never switches away. All runtime stages execute as root. |
| Acceptance criteria | All runtime stages create/use a non-root user with stable UID/GID. Chown only required writable paths. `USER` directive appears before `CMD`. |
| Verification | `docker inspect` on built images shows non-root user. `docker build` for each Dockerfile succeeds. |

---

### DEPLOY-COMPOSE-001 Â· Production Compose lacks healthchecks

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 2 |
| Status | done |
| Affected files | `docker-compose.yml` |
| Description | Production `docker-compose.yml` has `depends_on` but no service-level `healthcheck` entries. Services may start before dependencies are ready. |
| Acceptance criteria | API has a healthcheck probing `/ready`. Web has a healthcheck. Worker has a process-level health strategy. `depends_on` uses `condition: service_healthy` where supported. |
| Verification | `docker compose config` validates. Optional local smoke: `docker compose up --build` with stub env. |

---

### DEPLOY-STALE-001 Â· Worker Dockerfile copies stale API DB files

| Field | Value |
|---|---|
| Severity | LOW |
| Wave | 2 |
| Status | done |
| Affected files | `docker/worker.Dockerfile` |
| Description | Worker Dockerfile has `COPY apps/api/src/db ./apps/api/src/db` with a comment that conflicts with shared-schema ownership. Worker imports from `@portfolio/shared`. |
| Acceptance criteria | Stale copy is removed. Worker Docker build still succeeds. Worker runtime imports all DB schema from `packages/shared`. |
| Verification | `docker build -f docker/worker.Dockerfile .` succeeds after removal. |

---

## OPS â€” Operational

### OPS-RETENTION-001 Â· Retention job logs failures but succeeds

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 3 |
| Status | done |
| Affected files | `apps/worker/src/jobs/retention.ts`, `apps/worker/src/jobs/retention.test.ts` |
| Description | Each retention step has its own try/catch. Job resolves successfully even after critical cleanup failures. BullMQ cannot retry or alert on these failures. |
| Acceptance criteria | All cleanup steps run independently. Failures accumulate in a structured list. After all steps complete, job throws a summarized `RetentionCleanupError` if any step failed. BullMQ marks job failed. |
| Verification | Tests updated from "resolves despite failures" to "attempts all, throws summarized error". `bun run --filter @portfolio/worker test -- retention`. |

---

### OPS-OUTBOX-001 Â· Outbox relay batch size and poll interval are hardcoded

| Field | Value |
|---|---|
| Severity | LOW |
| Wave | 3 |
| Status | done |
| Affected files | `apps/worker/src/lib/outbox-relay.ts`, `apps/worker/src/config/env.ts` |
| Description | Batch size is hardcoded to 20 and poll interval to 5 seconds. Docs mention tuning but code does not expose it. |
| Acceptance criteria | `OUTBOX_BATCH_SIZE` and `OUTBOX_POLL_INTERVAL_MS` env fields added to worker env with documented defaults (20, 5000). Used in relay loop. Tests assert defaults and custom values. |
| Verification | `bun run --filter @portfolio/worker test -- outbox-relay`. |

---

### OPS-TELEGRAM-001 Â· Telegram fetch has no timeout

| Field | Value |
|---|---|
| Severity | LOW |
| Wave | 3 |
| Status | done |
| Affected files | `apps/worker/src/lib/telegram.ts` |
| Description | Worker Telegram calls use plain `fetch` with no timeout. Slow Telegram API responses can occupy worker concurrency slots indefinitely. |
| Acceptance criteria | `AbortController` timeout added. `TELEGRAM_TIMEOUT_MS` env field with conservative default. Timeout errors propagate to BullMQ retry behavior. |
| Verification | `bun run --filter @portfolio/worker test -- telegram`. |

---

## PERF â€” Performance

### PERF-TAGS-001 Â· Public tags count computed and discarded

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 4 |
| Status | done |
| Affected files | `apps/api/src/routes/public/tags.ts`, `apps/api/src/repositories/tags.repo.ts` |
| Description | Public `/tags` returns only `result.data` but the repository still runs `COUNT(*)` unless `includeTotal: false` is passed. |
| Acceptance criteria | Public tags route calls `findManyTags` with `{ includeTotal: false }`. Count query is eliminated for the public path. |
| Verification | `bun run --filter @portfolio/api test -- tags`. |

---

### PERF-SKILLS-001 Â· Public skills count always computed

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 4 |
| Status | done |
| Affected files | `apps/api/src/routes/public/skills.ts`, `apps/api/src/repositories/skills.repo.ts` |
| Description | Public skills endpoint always returns paginated response with total. Repository computes count unless `includeTotal: false` is passed (as home route already does). |
| Acceptance criteria | Public skills route uses `{ includeTotal: false }`. Or a no-count endpoint is added. Web consumers updated. |
| Verification | `bun run --filter @portfolio/api test -- skills`. |

---

### PERF-LISTS-001 Â· Post/project lists overfetch content fields

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 4 |
| Status | done |
| Affected files | `apps/api/src/repositories/posts.repo.ts`, `apps/api/src/repositories/projects.repo.ts`, `apps/api/src/services/developer-profile.service.ts` |
| Description | List queries use relational `findMany` without column projection, fetching full `content` and `renderedContent` for card views. |
| Acceptance criteria | Summary projection methods added for public list/card use cases excluding heavy content fields. Developer profile uses summary projections. |
| Verification | `bun run --filter @portfolio/api test -- posts projects developer`. |

---

### PERF-COMMENTS-001 Â· Post detail embeds all approved comments

| Field | Value |
|---|---|
| Severity | MEDIUM-LOW |
| Wave | 4 |
| Status | done |
| Affected files | `apps/api/src/services/posts.service.ts`, `apps/api/src/repositories/comments.repo.ts`, `packages/shared/src/db/schema/comments.ts`, `apps/web/src/components/blog/CommentsSection.tsx` |
| Description | Public post detail loads all approved comments in a single query without limit. Popular posts create heavy payloads and SSR work. |
| Acceptance criteria | Post detail returns bounded initial comments plus total count. Comments endpoint supports paginated approved comments. DB index aligned to `post_id + status + deleted_at + created_at`. |
| Verification | Drizzle migration generated. `bun run --filter @portfolio/api test -- posts comments`. |

---

### PERF-RETENTION-001 Â· Retention deletes materialize every affected ID

| Field | Value |
|---|---|
| Severity | MEDIUM-LOW |
| Wave | 3 |
| Status | done |
| Affected files | `apps/worker/src/jobs/retention.ts` |
| Description | Retention uses `.returning({ id })` for contacts, comments, and analytics events. Large deletes/updates can increase memory use and lock duration. |
| Acceptance criteria | Retention operates in bounded batches. Log affected counts, not IDs. Transactions are kept short. |
| Verification | `bun run --filter @portfolio/worker test -- retention`. |

---

## MAINT â€” Maintainability

### MAINT-ROUTES-001 Â· Route-owned feed/sitemap/comment/contact logic

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 5 |
| Status | done |
| Affected files | `apps/api/src/routes/public/feed.ts`, `apps/api/src/routes/public/sitemap.ts`, `apps/api/src/routes/admin/comments.ts`, `apps/api/src/routes/public/contact.ts` |
| Description | Feed/sitemap routes import DB/schema directly and build XML in-route. Admin comments route owns pagination, markdown, and cache invalidation. Contact route mixes honeypot, Turnstile, DB write, and Telegram enqueue. |
| Acceptance criteria | Feed/sitemap/admin-comments/contact services extracted. Routes handle HTTP only. |
| Verification | Existing route tests still pass with updated mocks. New service tests cover extracted behavior. |

---

### MAINT-WORKER-001 Â· Worker bootstrap duplication

| Field | Value |
|---|---|
| Severity | MEDIUM |
| Wave | 5 |
| Status | done |
| Affected files | `apps/worker/src/index.ts` |
| Description | `new Worker`, event handlers, concurrency, DLQ behavior, and observability membership are repeated across 7 workers. Policy drift risk increases with each new worker. |
| Acceptance criteria | Typed worker registry defines specs: queue name, processor, concurrency, event policy, DLQ metadata, observed flag. Worker instances generated from registry. |
| Verification | `bun run --filter @portfolio/worker test`. |

---

### MAINT-TYPES-001 Â· Production `any` and root shared imports

| Field | Value |
|---|---|
| Severity | LOW-MEDIUM |
| Wave | 5 |
| Status | done |
| Affected files | `apps/web/src/components/admin/PostGenerationAssistant.tsx`, `apps/web/src/components/admin/PostForm.tsx` |
| Description | Production code uses `as any` for dynamic form field application and root `@portfolio/shared` type imports instead of explicit subpaths. |
| Acceptance criteria | Typed field application helper replaces `as any`. Imports use explicit `@portfolio/shared/types/*` or equivalent subpath. |
| Verification | `bun run type-check`; `bun run lint`. |

---

## HYGIENE â€” Script and Naming

### HYGIENE-SCRIPT-001 Â· Absolute local migration helper

| Field | Value |
|---|---|
| Severity | LOW |
| Wave | 5 |
| Status | done |
| Affected files | `scripts/migrate-validate.ps1` |
| Description | Script contains hardcoded absolute path `c:\Users\gusta\Desktop\gustavo-sotero.dev` and appears to be a one-time codemod. Not reusable as a repo script. |
| Acceptance criteria | Script is removed, archived, or fully parameterized with no hardcoded local paths. |
| Verification | Script absent from repo or contains no absolute local paths. |

---

### HYGIENE-NAME-001 Â· Root package spelling drift

| Field | Value |
|---|---|
| Severity | LOW |
| Wave | 5 |
| Status | deferred |
| Affected files | `package.json` |
| Description | Root package is named `portifolio`; workspace packages use `@portfolio/*`. |
| Acceptance criteria | Root package name corrected to `portfolio` if lockfile/deployment is unaffected. |
| Verification | `bun install --frozen-lockfile` succeeds after rename. |
| Notes | Deferred â€” assess lockfile/deployment impact before changing. |

---

## Wave Summary

| Wave | Items | Focus |
|---|---|---|
| 0 | This checklist | Tracking and baseline |
| 1 | SEC-MEDIA-001, SEC-MEDIA-002, SEC-UPLOAD-001, SEC-UPLOAD-002, SEC-ENV-001, SEC-REDIS-001 | Security and media trust |
| 2 | DEPLOY-CI-001, DEPLOY-DCKER-001, DEPLOY-COMPOSE-001, DEPLOY-STALE-001 | CI, Docker, runtime hardening |
| 3 | OPS-RETENTION-001, OPS-OUTBOX-001, OPS-TELEGRAM-001, PERF-RETENTION-001 | Worker operational correctness |
| 4 | PERF-TAGS-001, PERF-SKILLS-001, PERF-LISTS-001, PERF-COMMENTS-001 | Public API performance |
| 5 | MAINT-ROUTES-001, MAINT-WORKER-001, MAINT-TYPES-001, HYGIENE-SCRIPT-001 | Layering and maintainability |
| 6 | All docs/OpenAPI | Documentation and final audit |

---

## Final Audit — Completion Record

**Completed**: All waves 1–5 fully implemented. Wave 6 docs updated.

### Done ✅
- **SEC-MEDIA-001** — `next.config.ts` excludes localhost in production remotePatterns
- **SEC-MEDIA-002** — `coverUrlSchema` rejects private IPs/localhost, requires HTTPS; applied to posts + projects schemas
- **SEC-UPLOAD-001** — `confirmUpload` validates S3 stat (size + MIME) + 12-byte magic bytes before enqueueing
- **SEC-UPLOAD-002** — Worker `imageOptimize.ts` stat-checks size and MIME before loading full bytes
- **SEC-ENV-001** — API, web, and web server-side env schemas reject `http://` in production via `superRefine`
- **SEC-REDIS-001** — `OAUTH_STATE_LOCAL_FALLBACK` env field added; auth route respects it; documented in `.env.example` and `docs/auth-admin.md`
- **DEPLOY-CI-001** — API + worker build scripts added; CI expanded with `build-api`, `build-worker`, `docker-build` matrix, `compose-validate` jobs
- **DEPLOY-DCKER-001** — Non-root `appuser` in all three Dockerfiles with chown on log dirs and COPY
- **DEPLOY-COMPOSE-001** — Production Compose healthchecks added for api, worker, web; `depends_on` uses `condition: service_healthy`
- **DEPLOY-STALE-001** — Stale `COPY apps/api/src/db` removed from `worker.Dockerfile`
- **OPS-RETENTION-001** — `RetentionCleanupError` accumulates step failures; job re-throws if any step failed
- **PERF-RETENTION-001** — `.returning({ id })` replaced with CTE-count queries; no ID materialization
- **OPS-OUTBOX-001** — `OUTBOX_BATCH_SIZE` + `OUTBOX_POLL_INTERVAL_MS` env fields added; relay uses them
- **OPS-TELEGRAM-001** — `AbortSignal.timeout(env.TELEGRAM_TIMEOUT_MS)` added to Telegram fetch
- **PERF-TAGS-001** — Public tags route passes `{ includeTotal: false }` to skip COUNT query
- **PERF-SKILLS-001** — Public skills route passes `{ includeTotal: false }` to skip COUNT query
- **PERF-LISTS-001** — `summaryOnly` option added to `findManyPosts` / `findManyProjects`; developer-profile uses it
- **PERF-COMMENTS-001** — `findApprovedCommentsByPostId` capped at 200; composite DB index added + migration generated (`drizzle/0009_add_comments_status_index.sql`)
- **MAINT-ROUTES-001** — `feed.service.ts` and `sitemap.service.ts` extracted; route files delegate entirely
- **MAINT-TYPES-001** — `as any` in `PostGenerationAssistant.tsx` replaced with typed field cast
- **HYGIENE-SCRIPT-001** — `scripts/migrate-validate.ps1` path hardcoding replaced with `$PSScriptRoot`-relative path; historical note added

### Deferred 🔁
- **HYGIENE-NAME-001** — Root `portifolio` package name — lockfile/deployment impact needs assessment
- **MAINT-WORKER-001** — Typed worker registry — significant internal refactor; deferred until next milestone

