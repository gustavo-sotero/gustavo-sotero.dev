'use client';

import type { CreateTagInput, Tag, UpdateTagInput } from '@portfolio/shared';
import { useQuery } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { tagMutationTags } from '@/lib/data/public/cache-tags';
import { useAdminMutation } from './mutation';
import { adminKeys } from './query-keys';

export function useAdminTags(category?: string) {
  const query = category ? `?category=${category}` : '';
  return useQuery<Tag[]>({
    queryKey: adminKeys.tags({ category }),
    queryFn: () => apiGet<Tag[]>(`/admin/tags${query}`).then((r) => r?.data as Tag[]),
  });
}

export function useCreateTag() {
  return useAdminMutation({
    mutationFn: (data: CreateTagInput) => apiPost<Tag>('/admin/tags', data),
    invalidate: [
      ['admin', 'tags'],
      ['admin', 'posts'],
    ],
    revalidateTags: () => tagMutationTags(),
    successToast: 'Tag de post criada com sucesso!',
    errorToast: 'Erro ao criar tag de post.',
  });
}

export function useUpdateTag() {
  return useAdminMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateTagInput }) =>
      apiPatch<Tag>(`/admin/tags/${id}`, data),
    invalidate: [
      ['admin', 'tags'],
      ['admin', 'posts'],
    ],
    revalidateTags: () => tagMutationTags(),
    successToast: 'Tag de post atualizada.',
    errorToast: 'Erro ao atualizar tag de post.',
  });
}

export function useDeleteTag() {
  return useAdminMutation({
    mutationFn: (id: number) => apiDelete(`/admin/tags/${id}`),
    invalidate: [
      ['admin', 'tags'],
      ['admin', 'posts'],
    ],
    revalidateTags: () => tagMutationTags(),
    successToast: 'Tag de post excluída.',
    errorToast: 'Erro ao excluir tag de post.',
  });
}

/**
 * Resolve AI-suggested tag names to persisted tag IDs.
 * Missing tags are auto-created with category inferred from the shared ICON_CATALOG.
 * Only call this when the admin explicitly accepts a draft.
 */
export function useResolveAiSuggestedTags() {
  return useAdminMutation({
    mutationFn: (names: string[]) => apiPost<Tag[]>('/admin/tags/resolve-ai-suggested', { names }),
    invalidate: [
      ['admin', 'tags'],
      ['admin', 'posts'],
    ],
    revalidateTags: () => tagMutationTags(),
    errorToast: 'Erro ao criar tags de post sugeridas pela IA.',
  });
}
