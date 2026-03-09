import 'server-only';
import type { Education, Experience, Post, Project, Tag } from '@portfolio/shared';
import { cacheLife, cacheTag } from 'next/cache';
import { apiServerGet, apiServerGetPaginated } from '@/lib/api.server';
import { logServerError } from '@/lib/server-logger';
import {
  TAG_EDUCATION_LIST,
  TAG_EXPERIENCE_LIST,
  TAG_HOME,
  TAG_POSTS_LIST,
  TAG_PROJECTS_LIST,
  TAG_TAGS_LIST,
} from './cache-tags';

/**
 * Typed result for home section loaders.
 *
 * - `ok`       — request succeeded, data has items.
 * - `empty`    — request succeeded, backend returned no items (legitimate empty state).
 * - `degraded` — request failed; section should render a visible unavailable state
 *                instead of silently appearing as if there is no content.
 */
export type HomeLoaderResult<T> =
  | { state: 'ok'; data: T[] }
  | { state: 'empty'; data: T[] }
  | { state: 'degraded' };

/** Mixed projects for the home section (max 3, featured-first ordering, published). */
export async function getHomeFeaturedProjects(): Promise<HomeLoaderResult<Project>> {
  'use cache';
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(TAG_HOME, TAG_PROJECTS_LIST);

  try {
    const res = await apiServerGetPaginated<Project>('/projects?featuredFirst=true&perPage=3');
    return res.data.length > 0 ? { state: 'ok', data: res.data } : { state: 'empty', data: [] };
  } catch (err) {
    logServerError('data:home', 'Failed to fetch featured projects', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { state: 'degraded' };
  }
}

/** Recent posts for the home section (max 3). */
export async function getHomeRecentPosts(): Promise<HomeLoaderResult<Post>> {
  'use cache';
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(TAG_HOME, TAG_POSTS_LIST);

  try {
    const res = await apiServerGetPaginated<Post>('/posts?perPage=3');
    return res.data.length > 0 ? { state: 'ok', data: res.data } : { state: 'empty', data: [] };
  } catch (err) {
    logServerError('data:home', 'Failed to fetch recent posts', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { state: 'degraded' };
  }
}

/** All published tags for hero/skills sections. */
export async function getHomeTags(): Promise<HomeLoaderResult<Tag>> {
  'use cache';
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 });
  cacheTag(TAG_HOME, TAG_TAGS_LIST);

  try {
    const data = await apiServerGet<Tag[]>('/tags');
    const tags = Array.isArray(data) ? data : [];
    return tags.length > 0 ? { state: 'ok', data: tags } : { state: 'empty', data: [] };
  } catch (err) {
    logServerError('data:home', 'Failed to fetch tags', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { state: 'degraded' };
  }
}

/** Professional experience entries (all published). */
export async function getHomeExperience(): Promise<HomeLoaderResult<Experience>> {
  'use cache';
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(TAG_HOME, TAG_EXPERIENCE_LIST);

  try {
    const res = await apiServerGetPaginated<Experience>('/experience?status=published&perPage=10');
    return res.data.length > 0 ? { state: 'ok', data: res.data } : { state: 'empty', data: [] };
  } catch (err) {
    logServerError('data:home', 'Failed to fetch experience', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { state: 'degraded' };
  }
}

/** Education entries (all published). */
export async function getHomeEducation(): Promise<HomeLoaderResult<Education>> {
  'use cache';
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(TAG_HOME, TAG_EDUCATION_LIST);

  try {
    const res = await apiServerGetPaginated<Education>('/education?status=published&perPage=10');
    return res.data.length > 0 ? { state: 'ok', data: res.data } : { state: 'empty', data: [] };
  } catch (err) {
    logServerError('data:home', 'Failed to fetch education', {
      error: err instanceof Error ? err.message : String(err),
    });
    return { state: 'degraded' };
  }
}
