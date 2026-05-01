'use client';

import type { PaginatedResponse } from '@portfolio/shared/types/api';
import type { Contact } from '@portfolio/shared/types/contacts';
import { useQuery } from '@tanstack/react-query';
import { apiGetPaginated, apiPatch } from '@/lib/api';
import { useAdminMutation } from './mutation';
import { adminKeys } from './query-keys';

interface ContactsQueryParams {
  page?: number;
  perPage?: number;
  read?: boolean;
}

export function useAdminContacts(params: ContactsQueryParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  if (params.read !== undefined) qs.set('read', String(params.read));
  const query = qs.toString();
  return useQuery<PaginatedResponse<Contact>>({
    queryKey: adminKeys.contacts(params),
    queryFn: () => apiGetPaginated<Contact>(`/admin/contacts${query ? `?${query}` : ''}`),
  });
}

export function useMarkContactRead() {
  return useAdminMutation({
    mutationFn: (id: number) => apiPatch<Contact>(`/admin/contacts/${id}/read`, {}),
    invalidate: [['admin', 'contacts']],
    errorToast: 'Erro ao marcar contato como lido.',
  });
}
