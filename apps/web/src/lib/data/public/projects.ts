import 'server-only';
import type { PaginationMeta, Project } from '@portfolio/shared';
import { cacheLife, cacheTag } from 'next/cache';
import { ApiNotFoundError, apiServerGet, apiServerGetPaginated } from '@/lib/api.server';
import { logServerError } from '@/lib/server-logger';
import { TAG_PROJECTS_LIST, tagProjectDetail } from './cache-tags';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Result for project listing requests.
 *
 * - `ok`       — request succeeded with items.
 * - `empty`    — request succeeded but backend returned no items.
 * - `degraded` — API was unreachable; render a visible unavailable state.
 */
export type ProjectsListResult =
  | { state: 'ok' | 'empty'; data: Project[]; meta: PaginationMeta }
  | { state: 'degraded' };

// ─── List ─────────────────────────────────────────────────────────────────────

export interface ProjectsListParams {
  page?: number;
  perPage?: number;
  skill?: string;
  featured?: boolean;
  featuredFirst?: boolean;
}

export async function getPublicProjects(
  params: ProjectsListParams = {}
): Promise<ProjectsListResult> {
  'use cache';
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(TAG_PROJECTS_LIST);

  const qs = new URLSearchParams({ perPage: String(params.perPage ?? 9) });
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  if (params.skill) qs.set('skill', params.skill);
  if (params.featured !== undefined) qs.set('featured', String(params.featured));
  if (params.featuredFirst !== undefined) qs.set('featuredFirst', String(params.featuredFirst));

  try {
    const res = await apiServerGetPaginated<Project>(`/projects?${qs}`);
    return {
      state: res.data.length > 0 ? 'ok' : 'empty',
      data: res.data,
      meta: res.meta,
    };
  } catch (err) {
    logServerError('data:projects', 'Failed to fetch public projects list', {
      params: String(JSON.stringify(params)),
      error: err instanceof Error ? err.message : String(err),
    });
    return { state: 'degraded' };
  }
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export type ProjectDetailResult =
  | { state: 'ok'; data: Project }
  | { state: 'not-found' }
  | { state: 'degraded' };

export async function getPublicProjectDetail(slug: string): Promise<ProjectDetailResult> {
  'use cache';
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 });
  cacheTag(TAG_PROJECTS_LIST, tagProjectDetail(slug));

  try {
    return { state: 'ok', data: await apiServerGet<Project>(`/projects/${slug}`) };
  } catch (err) {
    if (err instanceof ApiNotFoundError) return { state: 'not-found' };

    logServerError('data:projects', 'Failed to fetch public project detail', {
      slug,
      error: err instanceof Error ? err.message : String(err),
    });

    return { state: 'degraded' };
  }
}
