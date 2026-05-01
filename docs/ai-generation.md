# AI Post Generation — Async Flow and Runs

## Overview

AI-assisted post creation runs asynchronously via BullMQ workers. The flow has two phases:

1. **Topic generation** — suggests post topics/angles for a category.
2. **Draft generation** — generates a full draft from a selected topic suggestion.

Both flows use the same pattern: create a run record in the DB, enqueue a job via the outbox, poll for status.

## Endpoints

| Action | Endpoint | Notes |
|--------|---------|-------|
| Create topic run | `POST /admin/posts/generate/topic-runs` | Returns `202` + `{ runId }` |
| Poll topic run | `GET /admin/posts/generate/topic-runs/:id` | Returns run status/result |
| Create draft run | `POST /admin/posts/generate/draft-runs` | Returns `202` + `{ runId }` |
| Poll draft run | `GET /admin/posts/generate/draft-runs/:id` | Returns run status/result |
| Read/write config | `GET/PUT /admin/posts/generate/config` | Model selection + provider routing |
| List available models | `GET /admin/posts/generate/models` | Live from OpenRouter |

Legacy synchronous endpoints (`POST /topics`, `POST /draft`) remain available for diagnostics and compatibility with the admin assistant UI.

## Run Lifecycle

```
queued → running → validating → completed
                ↘ failed
                ↘ timed_out
```

Stage transitions:
- `resolving-config` → `building-prompt` → `requesting-provider` → `normalizing-output` → `canonicalizing-tags` → `validating-output` → `persisting-result` → `completed`

Heartbeat (`lastHeartbeatAt`) is updated at each stage transition. A stale heartbeat after the timeout window indicates a stuck worker.

## Shared Worker Logic

Both draft and topic jobs use helpers from `apps/worker/src/lib/ai-job-utils.ts`:

- `classifyJobError(err)` — classifies raw config-shaped failures as `'config'`; any other unknown error falls back to `'internal'`.
- `resolveAiJobFailure(job, err)` — derives the persisted `errorKind`, `errorCode`, terminal run status, and whether BullMQ should retry.
- `shouldRetryProviderFailure(job, errorKind)` — returns `true` for `'provider'` and `'timeout'` errors when retry attempts remain.

After a terminal DB state is persisted, both jobs throw `UnrecoverableError` to prevent BullMQ from scheduling further retries. Transient provider failures (`provider`, `timeout`) are re-thrown as normal errors so BullMQ retries them.

AI draft/topic jobs are enqueued with `attempts: 2` and exponential backoff (`2000ms` base delay), so a timeout now receives one automatic retry before the run becomes terminal.

## Error Contract

Synchronous admin endpoints use the shared HTTP error taxonomy:

- `CONFIGURATION_ERROR` for disabled/misconfigured AI features.
- `PROVIDER_TRANSIENT` for temporary provider/catalog failures.
- `PROVIDER_TERMINAL` for refusals or invalid structured outputs that need a new prompt/request.
- `TIMEOUT` for upstream provider deadlines.

Asynchronous run polling keeps the lower-level `error.kind` field from the worker runtime (`timeout`, `provider`, `validation`, `refusal`, `disabled`, `not-configured`, `invalid-config`, `catalog-unavailable`) and falls back to `config` or `internal` only for raw non-typed failures.

## Configuration

- `AI_POSTS_ENABLED` — enables the async generation flows (default: `false`).
- `OPENROUTER_API_KEY` — required when enabled.
- `AI_POSTS_TIMEOUT_MS` — per-request timeout for the AI provider (applied in both sync and async paths).
- Model IDs and provider routing preferences are stored per-operation in the `ai_post_generation_settings` DB table and managed via the admin config endpoint.

## Tag Canonicalization

Suggested tag names are canonicalized before the run result is stored:
1. Exact matches to existing tags (case-insensitive) are replaced with the canonical name.
2. Near-matches are resolved using the shared `aiTagNormalizer` in `packages/shared/src/lib/aiTagNormalizer.ts`.
3. Unknown tags are created at draft acceptance time (not during generation).

## AI Structured Output

Both jobs call `generateStructuredObject` in `apps/worker/src/lib/ai/generateStructuredObject.ts`, which wraps the OpenRouter API and returns a typed result including `providerGenerationId`, `durationMs`, `inputTokens`, and `outputTokens` for observability.
