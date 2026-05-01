'use client';

import type { PostStatus } from '@portfolio/shared/constants/enums';
import type { CreatePostInput, UpdatePostInput } from '@portfolio/shared/schemas/posts';
import type { PaginatedResponse } from '@portfolio/shared/types/api';
import type { Post } from '@portfolio/shared/types/posts';
import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { postMutationTags, postMutationTagsWithSlugTransition } from '@/lib/data/public/cache-tags';
import { useAdminMutation } from './mutation';
import { adminKeys } from './query-keys';

interface PostsQueryParams {
  page?: number;
  perPage?: number;
  status?: PostStatus;
  tag?: string;
}

export function useAdminPosts(params: PostsQueryParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  if (params.status) qs.set('status', params.status);
  if (params.tag) qs.set('tag', params.tag);
  const query = qs.toString();
  return useQuery<PaginatedResponse<Post>>({
    queryKey: adminKeys.posts(params),
    queryFn: () => apiGetPaginated<Post>(`/admin/posts${query ? `?${query}` : ''}`),
  });
}

export function useAdminPost(slug: string, options?: Partial<UseQueryOptions<Post>>) {
  return useQuery<Post>({
    queryKey: adminKeys.post(slug),
    queryFn: () => apiGet<Post>(`/admin/posts/${slug}`).then((r) => r?.data as Post),
    enabled: !!slug,
    ...(options as object),
  });
}

export function useCreatePost() {
  return useAdminMutation({
    mutationFn: (data: CreatePostInput) => apiPost<Post>('/admin/posts', data),
    invalidate: [['admin', 'posts']],
    revalidateTags: () => postMutationTags(),
    successToast: 'Post criado com sucesso!',
    errorToast: 'Erro ao criar post.',
  });
}

export function useUpdatePost(id: number, previousSlug?: string) {
  return useAdminMutation({
    mutationFn: (data: UpdatePostInput) => apiPatch<Post>(`/admin/posts/${id}`, data),
    invalidate: [['admin', 'posts'], ({ data }) => ['admin', 'post', data?.data.slug]],
    revalidateTags: ({ data }) => postMutationTagsWithSlugTransition(previousSlug, data?.data.slug),
    successToast: 'Post atualizado com sucesso!',
    errorToast: 'Erro ao atualizar post.',
  });
}

export function useDeletePost() {
  return useAdminMutation({
    mutationFn: ({ id }: { id: number; slug?: string }) => apiDelete(`/admin/posts/${id}`),
    invalidate: [['admin', 'posts']],
    revalidateTags: ({ variables }) => postMutationTags(variables.slug),
    successToast: 'Post excluído.',
    errorToast: 'Erro ao excluir post.',
  });
}
