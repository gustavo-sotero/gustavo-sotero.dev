'use client';

import type {
  CreateEducationInput,
  Education,
  PaginatedResponse,
  PostStatus,
  UpdateEducationInput,
} from '@portfolio/shared';
import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { educationMutationTags } from '@/lib/data/public/cache-tags';
import { useAdminMutation } from './mutation';
import { adminKeys } from './query-keys';

interface EducationQueryParams {
  page?: number;
  perPage?: number;
  status?: PostStatus;
}

export function useAdminEducation(params: EducationQueryParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  if (params.status) qs.set('status', params.status);
  const query = qs.toString();
  return useQuery<PaginatedResponse<Education>>({
    queryKey: adminKeys.education(params),
    queryFn: () => apiGetPaginated<Education>(`/admin/education${query ? `?${query}` : ''}`),
  });
}

export function useAdminEducationItem(slug: string, options?: Partial<UseQueryOptions<Education>>) {
  return useQuery<Education>({
    queryKey: adminKeys.educationItem(slug),
    queryFn: () => apiGet<Education>(`/admin/education/${slug}`).then((r) => r?.data as Education),
    enabled: !!slug,
    ...(options as object),
  });
}

export function useCreateEducation() {
  return useAdminMutation({
    mutationFn: (data: CreateEducationInput) => apiPost<Education>('/admin/education', data),
    invalidate: [['admin', 'education']],
    revalidateTags: () => educationMutationTags(),
    successToast: 'Formação criada com sucesso!',
    errorToast: 'Erro ao criar formação.',
  });
}

export function useUpdateEducation(id: number) {
  return useAdminMutation({
    mutationFn: (data: UpdateEducationInput) => apiPatch<Education>(`/admin/education/${id}`, data),
    invalidate: [
      ['admin', 'education'],
      ({ data }) => ['admin', 'education-item', data?.data.slug],
    ],
    revalidateTags: () => educationMutationTags(),
    successToast: 'Formação atualizada com sucesso!',
    errorToast: 'Erro ao atualizar formação.',
  });
}

export function useDeleteEducation() {
  return useAdminMutation({
    mutationFn: (id: number) => apiDelete(`/admin/education/${id}`),
    invalidate: [['admin', 'education']],
    revalidateTags: () => educationMutationTags(),
    successToast: 'Formação excluída.',
    errorToast: 'Erro ao excluir formação.',
  });
}
