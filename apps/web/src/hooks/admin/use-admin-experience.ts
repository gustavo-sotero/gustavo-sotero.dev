'use client';

import type {
  CreateExperienceInput,
  Experience,
  PaginatedResponse,
  PostStatus,
  UpdateExperienceInput,
} from '@portfolio/shared';
import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { experienceMutationTags } from '@/lib/data/public/cache-tags';
import { useAdminMutation } from './mutation';
import { adminKeys } from './query-keys';

interface ExperienceQueryParams {
  page?: number;
  perPage?: number;
  status?: PostStatus;
}

export function useAdminExperience(params: ExperienceQueryParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  if (params.status) qs.set('status', params.status);
  const query = qs.toString();
  return useQuery<PaginatedResponse<Experience>>({
    queryKey: adminKeys.experience(params),
    queryFn: () => apiGetPaginated<Experience>(`/admin/experience${query ? `?${query}` : ''}`),
  });
}

export function useAdminExperienceItem(
  slug: string,
  options?: Partial<UseQueryOptions<Experience>>
) {
  return useQuery<Experience>({
    queryKey: adminKeys.experienceItem(slug),
    queryFn: () =>
      apiGet<Experience>(`/admin/experience/${slug}`).then((r) => r?.data as Experience),
    enabled: !!slug,
    ...(options as object),
  });
}

export function useCreateExperience() {
  return useAdminMutation({
    mutationFn: (data: CreateExperienceInput) => apiPost<Experience>('/admin/experience', data),
    invalidate: [['admin', 'experience']],
    revalidateTags: () => experienceMutationTags(),
    successToast: 'Experiência criada com sucesso!',
    errorToast: 'Erro ao criar experiência.',
  });
}

export function useUpdateExperience(id: number) {
  return useAdminMutation({
    mutationFn: (data: UpdateExperienceInput) =>
      apiPatch<Experience>(`/admin/experience/${id}`, data),
    invalidate: [
      ['admin', 'experience'],
      ({ data }) => ['admin', 'experience-item', data?.data.slug],
    ],
    revalidateTags: () => experienceMutationTags(),
    successToast: 'Experiência atualizada com sucesso!',
    errorToast: 'Erro ao atualizar experiência.',
  });
}

export function useDeleteExperience() {
  return useAdminMutation({
    mutationFn: (id: number) => apiDelete(`/admin/experience/${id}`),
    invalidate: [['admin', 'experience']],
    revalidateTags: () => experienceMutationTags(),
    successToast: 'Experiência excluída.',
    errorToast: 'Erro ao excluir experiência.',
  });
}
