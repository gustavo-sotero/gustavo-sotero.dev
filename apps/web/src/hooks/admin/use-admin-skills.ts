'use client';

import type { CreateSkillInput, Skill, UpdateSkillInput } from '@portfolio/shared/types/skills';
import { useQuery } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPatch, apiPost } from '@/lib/api';
import { skillMutationTags } from '@/lib/data/public/cache-tags';
import { useAdminMutation } from './mutation';
import { adminKeys } from './query-keys';

export function useAdminSkills(category?: string) {
  const query = category ? `?category=${category}` : '';
  return useQuery<Skill[]>({
    queryKey: adminKeys.skills({ category }),
    queryFn: () => apiGet<Skill[]>(`/admin/skills${query}`).then((r) => r?.data as Skill[]),
  });
}

export function useCreateSkill() {
  return useAdminMutation({
    mutationFn: (data: CreateSkillInput) => apiPost<Skill>('/admin/skills', data),
    invalidate: [
      ['admin', 'skills'],
      ['admin', 'projects'],
      ['admin', 'experience'],
    ],
    revalidateTags: () => skillMutationTags(),
    successToast: 'Skill criada com sucesso!',
    errorToast: 'Erro ao criar skill.',
  });
}

export function useUpdateSkill() {
  return useAdminMutation({
    mutationFn: ({ id, data }: { id: number; data: UpdateSkillInput }) =>
      apiPatch<Skill>(`/admin/skills/${id}`, data),
    invalidate: [
      ['admin', 'skills'],
      ['admin', 'projects'],
      ['admin', 'experience'],
    ],
    revalidateTags: () => skillMutationTags(),
    successToast: 'Skill atualizada.',
    errorToast: 'Erro ao atualizar skill.',
  });
}

export function useDeleteSkill() {
  return useAdminMutation({
    mutationFn: (id: number) => apiDelete(`/admin/skills/${id}`),
    invalidate: [
      ['admin', 'skills'],
      ['admin', 'projects'],
      ['admin', 'experience'],
    ],
    revalidateTags: () => skillMutationTags(),
    successToast: 'Skill excluída.',
    errorToast: 'Erro ao excluir skill.',
  });
}
