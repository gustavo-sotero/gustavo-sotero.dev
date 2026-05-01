import 'server-only';
import type { PaginationMeta } from '@portfolio/shared/types/api';
import type { Comment } from '@portfolio/shared/types/comments';
import type { Post } from '@portfolio/shared/types/posts';
import { cacheLife, cacheTag } from 'next/cache';
import { ApiNotFoundError, apiServerGet, apiServerGetPaginated } from '@/lib/api.server';
import { logServerError } from '@/lib/server-logger';
import { TAG_POSTS_LIST, tagPostDetail } from './cache-tags';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Result for post listing requests.
 *
 * - `ok`       — request succeeded with items.
 * - `empty`    — request succeeded but backend returned no items.
 * - `degraded` — API was unreachable; render a visible unavailable state.
 */
export type PostsListResult =
  | { state: 'ok' | 'empty'; data: Post[]; meta: PaginationMeta }
  | { state: 'degraded' };

// ─── List ─────────────────────────────────────────────────────────────────────

export interface PostsListParams {
  page?: number;
  perPage?: number;
  tag?: string;
  sort?: 'manual' | 'recent';
}

export async function getPublicPosts(params: PostsListParams = {}): Promise<PostsListResult> {
  'use cache';
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(TAG_POSTS_LIST);

  const sort = params.sort ?? 'recent';
  const qs = new URLSearchParams({ perPage: String(params.perPage ?? 9), sort });
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  if (params.tag) qs.set('tag', params.tag);

  try {
    const res = await apiServerGetPaginated<Post>(`/posts?${qs}`);
    return {
      state: res.data.length > 0 ? 'ok' : 'empty',
      data: res.data,
      meta: res.meta,
    };
  } catch (err) {
    logServerError('data:posts', 'Failed to fetch public posts list', {
      params: String(JSON.stringify(params)),
      error: err instanceof Error ? err.message : String(err),
    });
    return { state: 'degraded' };
  }
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export type PostWithComments = Post & {
  comments?: Comment[];
  /** Total number of approved comments. Present when > initial preview limit. */
  commentCount?: number;
};

export type PostDetailResult =
  | { state: 'ok'; data: PostWithComments }
  | { state: 'not-found' }
  | { state: 'degraded' };

export async function getPublicPostDetail(slug: string): Promise<PostDetailResult> {
  'use cache';
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 });
  cacheTag(TAG_POSTS_LIST, tagPostDetail(slug));

  try {
    return { state: 'ok', data: await apiServerGet<PostWithComments>(`/posts/${slug}`) };
  } catch (err) {
    if (err instanceof ApiNotFoundError) return { state: 'not-found' };

    logServerError('data:posts', 'Failed to fetch public post detail', {
      slug,
      error: err instanceof Error ? err.message : String(err),
    });

    return { state: 'degraded' };
  }
}
