import 'server-only';
import type { Comment, PaginatedResponse, Post } from '@portfolio/shared';
import { cacheLife, cacheTag } from 'next/cache';
import { ApiNotFoundError, apiServerGet, apiServerGetPaginated } from '@/lib/api.server';
import { logServerError } from '@/lib/server-logger';
import { TAG_POSTS_LIST, tagPostDetail } from './cache-tags';

// ─── List ─────────────────────────────────────────────────────────────────────

export interface PostsListParams {
  page?: number;
  perPage?: number;
  tag?: string;
}

export async function getPublicPosts(
  params: PostsListParams = {}
): Promise<PaginatedResponse<Post>> {
  'use cache';
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(TAG_POSTS_LIST);

  const qs = new URLSearchParams({ perPage: String(params.perPage ?? 9) });
  if (params.page && params.page > 1) qs.set('page', String(params.page));
  if (params.tag) qs.set('tag', params.tag);

  try {
    return await apiServerGetPaginated<Post>(`/posts?${qs}`);
  } catch (err) {
    logServerError('data:posts', 'Failed to fetch public posts list', {
      params: String(JSON.stringify(params)),
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}

// ─── Detail ───────────────────────────────────────────────────────────────────

export type PostWithComments = Post & { comments?: Comment[] };

export async function getPublicPost(slug: string): Promise<PostWithComments | null> {
  'use cache';
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 });
  cacheTag(TAG_POSTS_LIST, tagPostDetail(slug));

  try {
    return await apiServerGet<PostWithComments>(`/posts/${slug}`);
  } catch (err) {
    if (err instanceof ApiNotFoundError) return null;
    throw err;
  }
}

// ─── SSG slugs ────────────────────────────────────────────────────────────────

export async function getPublishedPostSlugs(): Promise<string[]> {
  'use cache';
  cacheLife({ stale: 3600, revalidate: 3600, expire: 86400 });
  cacheTag(TAG_POSTS_LIST);

  try {
    const perPage = 100;
    const slugs: string[] = [];
    let page = 1;
    let totalPages = 1;

    while (page <= totalPages) {
      const res = await apiServerGetPaginated<{ slug: string }>(
        `/posts?perPage=${perPage}&page=${page}`
      );
      slugs.push(...res.data.map((post) => post.slug));

      totalPages = Math.max(1, res.meta?.totalPages ?? 1);
      page += 1;
    }

    return slugs;
  } catch (err) {
    logServerError('data:posts', 'Failed to fetch published post slugs for SSG', {
      error: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
