# Caching and Revalidation

## Layers

| Layer | Mechanism | Where |
|-------|-----------|-------|
| API in-process | `cached(key, ttl, fn)` in `apps/api/src/lib/cache.ts` | Services: posts, projects, skills, tags, analytics |
| Next.js Data Cache | `'use cache'` + `cacheLife` + `cacheTag` | `apps/web/src/lib/data/public/` loaders |
| On-demand invalidation | `revalidateTag(tag)` via `POST /_internal/revalidate` | Called from API after write operations |

## API Cache

The in-process cache wraps repeated read queries with a short TTL (typically 60–300 seconds). It lives in `apps/api/src/lib/cache.ts` and is per-process (not distributed). Cache is organized by group for invalidation:

- `invalidateGroup('posts')` clears all post-related entries.
- `invalidatePattern('tags:*')` clears all tag entries.

Cache is bypassed for admin reads (admin endpoints always include drafts and serve fresh data).

## Next.js Data Cache Tags

Web-side loaders tag their cache entries with constants from `apps/web/src/lib/data/public/cache-tags.ts`. Tag names are reused across loaders so that on-demand invalidation via `revalidateTag` is predictable.

Relevant tags:
- `TAG_HOME` — all home aggregate entries.
- `TAG_POSTS_LIST` — all post list entries (home + blog list).
- `TAG_PROJECTS_LIST` — all project list entries (home + projects page).
- `TAG_SKILLS_LIST`, `TAG_TAGS_LIST`, `TAG_EXPERIENCE_LIST`, `TAG_EDUCATION_LIST` — respective section lists.

## Home Aggregate Cache

The `getHomeAggregate()` loader in `apps/web/src/lib/data/public/home.ts` fetches `GET /home` in a single round-trip and is tagged with all home-relevant tags (`TAG_HOME`, `TAG_POSTS_LIST`, `TAG_PROJECTS_LIST`, etc.). All home page section wrappers call `getHomeAggregate()` — the `use cache` directive coalesces concurrent calls during the same render into one underlying fetch.

Any write operation that touches a section visible on the home page should call `revalidateTag` with the appropriate tag to invalidate both the aggregate and the relevant list entries.

## On-demand Revalidation

`POST /_internal/revalidate` accepts `{ tag: string, secret: string }` and calls `revalidateTag(tag)`. The `REVALIDATE_SECRET` environment variable guards this endpoint. The API calls it after content writes (posts, projects, skills, tags, etc.).

## Cache Lifetime Config

`cacheLife` parameters in web loaders:

| Section | `stale` | `revalidate` | `expire` |
|---------|---------|--------------|---------|
| Posts/Experience/Education/Home aggregate | 300 s | 300 s | 3600 s |
| Skills/Tags | 3600 s | 3600 s | 86400 s |
