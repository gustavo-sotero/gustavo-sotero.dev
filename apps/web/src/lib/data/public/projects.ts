import 'server-only';
import type { PaginatedResponse, Project } from '@portfolio/shared';
import { cacheLife, cacheTag } from 'next/cache';
import { ApiNotFoundError, apiServerGet, apiServerGetPaginated } from '@/lib/api.server';
import { logServerError } from '@/lib/server-logger';
import { TAG_PROJECTS_LIST, tagProjectDetail } from './cache-tags';

// ─── List ─────────────────────────────────────────────────────────────────────

export interface ProjectsListParams {
  page?: number;
  perPage?: number;
  tag?: string;
  featured?: boolean;
  featuredFirst?: boolean;
}

export async function getPublicProjects(
  params: ProjectsListParams = {}
): Promise<PaginatedResponse<Project>> {
  'use cache';
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(TAG_PROJECTS_LIST);

  const qs = new URLSearchParams({ perPage: String(params.perPage ?? 9) });
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  if (params.tag) qs.set('tag', params.tag);
  if (params.featured !== undefined) qs.set('featured', String(params.featured));
  if (params.featuredFirst !== undefined) qs.set('featuredFirst', String(params.featuredFirst));

  try {
    return await apiServerGetPaginated<Project>(`/projects?${qs}`);
  } catch (err) {
    logServerError('data:projects', 'Failed to fetch public projects list', {
      params: String(JSON.stringify(params)),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export async function getPublicProject(slug: string): Promise<Project | null> {
  'use cache';
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 });
  cacheTag(TAG_PROJECTS_LIST, tagProjectDetail(slug));

  try {
    return await apiServerGet<Project>(`/projects/${slug}`);
  } catch (err) {
    if (err instanceof ApiNotFoundError) return null;
    throw err;
  }
}

// ─── SSG slugs ────────────────────────────────────────────────────────────────

export async function getPublishedProjectSlugs(): Promise<string[]> {
  'use cache';
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 });
  cacheTag(TAG_PROJECTS_LIST);

  try {
    const perPage = 100;
    const slugs: string[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const res = await apiServerGetPaginated<{ slug: string }>(
        `/projects?perPage=${perPage}&page=${page}`
      );
      slugs.push(...res.data.map((project) => project.slug));

      totalPages = Math.max(1, res.meta?.totalPages ?? 1);
      page += 1;
    }

    return slugs;
  } catch (err) {
    logServerError('data:projects', 'Failed to fetch published project slugs for SSG', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
