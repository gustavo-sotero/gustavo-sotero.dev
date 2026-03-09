'use client';

import type { AdminComment, CommentStatus, PaginatedResponse } from '@portfolio/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch, apiGetPaginated, apiPatch, apiPost } from '@/lib/api';
import { adminKeys } from './query-keys';

interface CommentsQueryParams {
  page?: number;
  perPage?: number;
  status?: CommentStatus;
  deleted?: boolean;
  postId?: number;
}

export function useAdminComments(params: CommentsQueryParams = {}) {
  const qs = new URLSearchParams();
  if (params.page) qs.set('page', String(params.page));
  if (params.perPage) qs.set('perPage', String(params.perPage));
  if (params.status) qs.set('status', params.status);
  if (params.deleted !== undefined) qs.set('deleted', String(params.deleted));
  if (params.postId) qs.set('postId', String(params.postId));
  const query = qs.toString();
  return useQuery<PaginatedResponse<AdminComment>>({
    queryKey: adminKeys.comments(params),
    queryFn: () => apiGetPaginated<AdminComment>(`/admin/comments${query ? `?${query}` : ''}`),
  });
}

/**
 * Generic status mutation — handles pending|approved|rejected for any comment.
 * Optimistically updates the local comment list.
 */
export function useAdminUpdateCommentStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: CommentStatus; reason?: string }) =>
      apiPatch<AdminComment>(`/admin/comments/${id}/status`, {
        status,
        reason: undefined,
      }),
    onMutate: async ({ id, status }) => {
      await qc.cancelQueries({ queryKey: ['admin', 'comments'] });
      const snapshots = qc.getQueriesData<PaginatedResponse<AdminComment>>({
        queryKey: ['admin', 'comments'],
      });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<PaginatedResponse<AdminComment>>(key, {
          ...data,
          data: data?.data.map((c) => (c.id === id ? { ...c, status } : c)),
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          qc.setQueryData(key, data);
        }
      }
      toast.error('Erro ao atualizar status do comentário.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'comments'] });
    },
    onSuccess: (_res, { status }) => {
      const labels: Record<string, string> = {
        approved: 'Comentário aprovado.',
        rejected: 'Comentário rejeitado.',
        pending: 'Comentário movido para pendente.',
      };
      toast.success(labels[status] ?? 'Status atualizado.');
    },
  });
}

/** Convenience alias for approving a comment (legacy path still works too). */
export function useApproveComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/admin/comments/${id}/approve`, {}),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin', 'comments'] });
      const snapshots = qc.getQueriesData<PaginatedResponse<AdminComment>>({
        queryKey: ['admin', 'comments'],
      });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<PaginatedResponse<AdminComment>>(key, {
          ...data,
          data: data?.data.map((c) => (c.id === id ? { ...c, status: 'approved' as const } : c)),
        });
      }
      return { snapshots };
    },
    onError: (_err, _id, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          qc.setQueryData(key, data);
        }
      }
      toast.error('Erro ao aprovar comentário.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'comments'] });
    },
    onSuccess: () => {
      toast.success('Comentário aprovado.');
    },
  });
}

/** Convenience alias for rejecting a comment (legacy path still works too). */
export function useRejectComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => apiPost<void>(`/admin/comments/${id}/reject`, {}),
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: ['admin', 'comments'] });
      const snapshots = qc.getQueriesData<PaginatedResponse<AdminComment>>({
        queryKey: ['admin', 'comments'],
      });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<PaginatedResponse<AdminComment>>(key, {
          ...data,
          data: data?.data.map((c) => (c.id === id ? { ...c, status: 'rejected' as const } : c)),
        });
      }
      return { snapshots };
    },
    onError: (_err, _id, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          qc.setQueryData(key, data);
        }
      }
      toast.error('Erro ao rejeitar comentário.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'comments'] });
    },
    onSuccess: () => {
      toast.success('Comentário rejeitado.');
    },
  });
}

/** Post an admin reply to a comment. */
export function useAdminReplyComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: { postId: number; parentCommentId: string; content: string }) =>
      apiPost<AdminComment>('/admin/comments/reply', data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'comments'] });
      toast.success('Resposta publicada.');
    },
    onError: () => toast.error('Erro ao publicar resposta.'),
  });
}

/** Edit the content of any comment. */
export function useAdminEditCommentContent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, content, reason }: { id: string; content: string; reason?: string }) =>
      apiPatch<AdminComment>(`/admin/comments/${id}/content`, { content, reason }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'comments'] });
      toast.success('Comentário editado.');
    },
    onError: () => toast.error('Erro ao editar comentário.'),
  });
}

/** Soft-delete a comment. */
export function useAdminDeleteComment() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, reason }: { id: string; reason?: string }) =>
      apiFetch<AdminComment>(`/admin/comments/${id}`, {
        method: 'DELETE',
        body: reason ? JSON.stringify({ reason }) : undefined,
      }),
    onMutate: async ({ id }) => {
      await qc.cancelQueries({ queryKey: ['admin', 'comments'] });
      const snapshots = qc.getQueriesData<PaginatedResponse<AdminComment>>({
        queryKey: ['admin', 'comments'],
      });
      for (const [key, data] of snapshots) {
        if (!data) continue;
        qc.setQueryData<PaginatedResponse<AdminComment>>(key, {
          ...data,
          data: data?.data.filter((c) => c.id !== id),
          meta: { ...data.meta, total: Math.max(0, data.meta.total - 1) },
        });
      }
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      if (context?.snapshots) {
        for (const [key, data] of context.snapshots) {
          qc.setQueryData(key, data);
        }
      }
      toast.error('Erro ao excluir comentário.');
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'comments'] });
    },
    onSuccess: () => {
      toast.success('Comentário excluído.');
    },
  });
}
