# Outbox, Queues, and Worker

## Queue Catalog

Queue names are the single source of truth in `packages/shared/src/constants/queues.ts` (`QUEUE_NAMES`). Both the API (`apps/api/src/lib/queues.ts`) and the worker (`apps/worker/src/queues.ts`) import from this constant — there is no separate name list in either app.

| Queue | Producer | Consumer |
|-------|---------|---------|
| `telegram-notifications` | API `enqueueTelegramNotification` | Worker `telegram.ts` |
| `analytics-events` | API `enqueueAnalyticsEvent` | Worker analytics job |
| `image-optimize` | Outbox relay | Worker `image-optimize.ts` |
| `post-publish` | Outbox relay | Worker `post-publish.ts` |
| `ai-post-draft-generation` | Outbox relay | Worker `ai-post-draft-generation.ts` |
| `ai-post-topic-generation` | Outbox relay | Worker `ai-post-topic-generation.ts` |

DLQ queues (`telegram-notifications-dlq`, `image-optimize-dlq`) hold jobs that exhausted all retry attempts.

## Transactional Outbox

Image optimization, scheduled post publishing, and AI generation runs use a transactional outbox to guarantee at-least-once delivery. The flow:

1. The API writes the business record and an `outbox` row in the same DB transaction.
2. The outbox relay (`apps/worker/src/lib/outbox-relay.ts`) polls `outbox` for pending rows every `OUTBOX_POLL_INTERVAL_MS` (default 5000 ms) and publishes the corresponding BullMQ job.
3. Each published job has a deterministic `jobId` (from `packages/shared/src/lib/jobIds.ts`) — BullMQ deduplicates replays automatically.
4. On success the relay marks the row as `processed`. On failure it increments `attempts` and logs the failure class.

**Failure classes:**
- `UNSUPPORTED_EVENT_TYPE` — unknown `eventType`; logged as error, retried until `OUTBOX_MAX_ATTEMPTS` (5).
- `INVALID_PAYLOAD` — schema validation failed; logged as error, retried.
- `QUEUE_PUBLISH_FAILURE` — `queue.add()` threw; the job was never enqueued.
- `OUTBOX_STATUS_UPDATE_FAILURE` — `queue.add()` succeeded but the DB update failed; the job is live in BullMQ and will run.

**Upload reconciliation:** if the final relay attempt fails for an `IMAGE_OPTIMIZE` event and the queue publish never succeeded, the relay marks the `uploads` row as `failed` so the admin UI shows a terminal error instead of an indefinite processing state.

## Relay Observability

After each poll cycle the relay emits a structured log entry (`Outbox relay: cycle complete`) with:
- `backlogSize` — pending rows eligible for processing.
- `oldestPendingAgeMs` — age of the oldest pending row.
- `cycleDurationMs` — wall-clock duration of the cycle.
- `processedCount` / `failedCount` — per-cycle outcomes.

These signals are sufficient to detect backlog growth, processing lag, and saturation before tuning `OUTBOX_POLL_INTERVAL_MS` or batch size.

## Retry and Terminal Policy

- **Transient provider failures** (AI jobs): `shouldRetryProviderFailure` allows BullMQ retry while `job.attemptsMade < job.opts.attempts`. Both draft and topic jobs use this shared helper from `apps/worker/src/lib/ai-job-utils.ts`.
- **Terminal failures** (non-retryable errors): both draft and topic jobs persist a terminal DB state (`failed` or `timed_out`) then throw `UnrecoverableError` to prevent further BullMQ retries.

## Schema Ownership

| Artifact | Location |
|----------|---------|
| DB schema | `packages/shared/src/db/schema/` |
| Drizzle config | `apps/api/drizzle.config.ts` |
| Migration files | `drizzle/` (repository root) |

Migrations are generated from schema changes via `bun run db:generate` (root). They are applied via `bun run db:migrate`. The CI `api-schema-smoke` job runs migrations against a fresh PostgreSQL instance and executes `audit-schema-parity.ts` to confirm schema/DB parity after every merge.
