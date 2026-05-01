# Auth and Admin Surface

## Session Model

Authentication is GitHub OAuth-based. On successful callback the API issues two cookies:

| Cookie | Purpose |
|--------|---------|
| `admin_token` (HttpOnly, Secure) | Signed JWT — carries the admin identity. |
| `csrf_token` (SameSite=Strict, Secure) | CSRF token — must be re-sent as `X-CSRF-Token` header on all admin mutations. |

The JWT is verified by `authAdmin` middleware in `apps/api/src/middleware/auth.ts`.

The admin shell also probes `GET /auth/session` server-side to validate the current `admin_token` before rendering protected chrome.

## CSRF Protection

All `/admin/*` routes that use `POST`, `PUT`, `PATCH`, or `DELETE` pass through `csrfProtection` middleware, enforced in `apps/api/src/app.ts`. GET requests to admin routes do not require the CSRF token.

The web client (`apps/web/src/lib/api.ts`) reads the `csrf_token` cookie and injects it as `X-CSRF-Token` on every mutating fetch. CORS is configured to allow `X-CSRF-Token` in `allowHeaders`.

The set of methods guarded by CSRF and the set of methods declared in CORS `allowMethods` are derived from the same logic in `app.ts` — there is no separate list to keep in sync.

## Admin Routes

All admin routes live under `/admin/*`. They are protected by two layers:

1. `authAdmin` — verifies the JWT session cookie.
2. `csrfProtection` — verifies `X-CSRF-Token` for mutating methods.

There are no public exceptions within `/admin/*`. Webhook or integration endpoints that do not require a user session live outside the `/admin` prefix.

## OAuth Callback URL

The GitHub OAuth App must be configured with the **public** callback URL:

```
https://your-domain.com/api/auth/github/callback
```

After the proxy strips the `/api` prefix, the API processes the request at `/auth/github/callback`.

## OAuth State Storage and Redis Fallback

During the OAuth flow the API stores a CSRF state token in Redis under a short TTL. If Redis is unavailable, the API can fall back to a process-local in-memory map controlled by:

```
OAUTH_STATE_LOCAL_FALLBACK=true   # default — enables in-process fallback
OAUTH_STATE_LOCAL_FALLBACK=false  # fail-closed: returns 503 on Redis failure
```

The default (`true`) is safe for single-instance deployments. Set it to `false` in multi-replica or zero-downtime-restart environments where in-process state is not shared between instances.

## Security Notes

- Admin mutations (`PUT /admin/posts/generate/config` and similar) are within scope for CORS and CSRF protection.
- The `frame-src` CSP directive is derived from `ALLOWED_IFRAME_ORIGINS` in `apps/api/src/lib/iframe-policy.ts`. The same list drives the rehype sanitization allowlist — there is a single source of truth.
- Sensitive keys are never logged. The `normalizeCause` function in the error handler scrubs known sensitive field names before writing to structured logs.
