# Home Aggregate — Contract and Budget

## Problem Statement

The public home page needs data from 6 content domains (posts, projects, skills, tags, experience, education). Fetching each domain independently from the web SSR layer creates 5–6 serial or parallel API calls per uncached render, each carrying a `COUNT(*)` for pagination metadata that the home page never uses.

## Solution: GET /home

`GET /home` returns all home sections in a single response. It:
- Makes parallel DB queries for each domain internally.
- Returns fixed-size, editorial sets (no pagination metadata, no COUNT queries).
- Caches at the service layer via each domain's existing cached service.

**Response shape:**
```json
{
  "success": true,
  "data": {
    "posts":      [ /* max 3, manual ordering */ ],
    "projects":   [ /* max 3, featured-first */ ],
    "skills":     [ /* all public skills, perPage=100 */ ],
    "blogTags":   [ /* post tags only */ ],
    "experience": [ /* published, perPage=10 */ ],
    "education":  [ /* published, perPage=10 */ ]
  }
}
```

## Web Side: getHomeAggregate()

`apps/web/src/lib/data/public/home.ts` exports `getHomeAggregate()`, a `'use cache'`-tagged function that calls `GET /home` once. All six home section wrappers call this function:

- `HeroSectionWrapper` → `aggregate.skills`
- `FeaturedProjectsSection` → `aggregate.projects`
- `RecentPostsSection` → `aggregate.posts`
- `SkillsSection` → `aggregate.skills`
- `ExperienceSectionWrapper` → `aggregate.experience`
- `EducationSectionWrapper` → `aggregate.education`

With `'use cache'`, concurrent calls from Suspense boundaries within the same render are coalesced — the underlying fetch executes once. On a warm cache, no API call is made at all.

## Budget Invariant

The budget test in `apps/web/src/lib/data/public/home.test.ts` asserts:
- `getHomeAggregate()` calls `apiServerGet` **exactly once**.
- The call target is `/home`.
- `apiServerGetPaginated` is **never called** from the aggregate path.

This test guards against accidental fan-out regression.

## Existing Individual Loaders

The individual loaders (`getHomeFeaturedProjects`, `getHomeRecentPosts`, etc.) remain in `home.ts` and are tested independently. They are not used by the home page section wrappers, but are available for pages outside the home that need a specific section independently (e.g., a standalone `/experience` page).
