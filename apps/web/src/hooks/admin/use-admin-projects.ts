'use client';

import type { CreateProjectDto, PaginatedResponse, PostStatus, Project } from '@portfolio/shared';
import { type UseQueryOptions, useQuery } from '@tanstack/react-query';
import { apiDelete, apiGet, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import {
  projectMutationTags,
  projectMutationTagsWithSlugTransition,
} from '@/lib/data/public/cache-tags';
import { useAdminMutation } from './mutation';
import { adminKeys } from './query-keys';

interface ProjectsQueryParams {
  page?: number;
  perPage?: number;
  status?: PostStatus;
  skill?: string;
  featured?: boolean;
}

export function useAdminProjects(params: ProjectsQueryParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  if (params.status) qs.set('status', params.status);
  if (params.skill) qs.set('skill', params.skill);
  if (params.featured !== undefined) qs.set('featured', String(params.featured));
  const query = qs.toString();
  return useQuery<PaginatedResponse<Project>>({
    queryKey: adminKeys.projects(params),
    queryFn: () => apiGetPaginated<Project>(`/admin/projects${query ? `?${query}` : ''}`),
  });
}

export function useAdminProject(slug: string, options?: Partial<UseQueryOptions<Project>>) {
  return useQuery<Project>({
    queryKey: adminKeys.project(slug),
    queryFn: () => apiGet<Project>(`/admin/projects/${slug}`).then((r) => r?.data as Project),
    enabled: !!slug,
    ...(options as object),
  });
}

export function useCreateProject() {
  return useAdminMutation({
    mutationFn: (data: CreateProjectDto) => apiPost<Project>('/admin/projects', data),
    invalidate: [['admin', 'projects']],
    revalidateTags: () => projectMutationTags(),
    successToast: 'Projeto criado com sucesso!',
    errorToast: 'Erro ao criar projeto.',
  });
}

export function useUpdateProject(id: number, previousSlug?: string) {
  return useAdminMutation({
    mutationFn: (data: Partial<CreateProjectDto>) =>
      apiPatch<Project>(`/admin/projects/${id}`, data),
    invalidate: [['admin', 'projects'], ({ data }) => ['admin', 'project', data?.data.slug]],
    revalidateTags: ({ data }) =>
      projectMutationTagsWithSlugTransition(previousSlug, data?.data.slug),
    successToast: 'Projeto atualizado com sucesso!',
    errorToast: 'Erro ao atualizar projeto.',
  });
}

export function useDeleteProject() {
  return useAdminMutation({
    mutationFn: ({ id }: { id: number; slug?: string }) => apiDelete(`/admin/projects/${id}`),
    invalidate: [['admin', 'projects']],
    revalidateTags: ({ variables }) => projectMutationTags(variables.slug),
    successToast: 'Projeto excluído.',
    errorToast: 'Erro ao excluir projeto.',
  });
}
