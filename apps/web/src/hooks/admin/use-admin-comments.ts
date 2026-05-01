'use client';

import type { CommentStatus } from '@portfolio/shared/constants/enums';
import type { PaginatedResponse } from '@portfolio/shared/types/api';
import type { AdminComment } from '@portfolio/shared/types/comments';
import { type QueryKey, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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

type CommentsSnapshot = Array<[QueryKey, PaginatedResponse<AdminComment> | undefined]>;

async function snapshotComments(qc: ReturnType<typeof useQueryClient>) {
  await qc.cancelQueries({ queryKey: ['admin', 'comments'] });
  return qc.getQueriesData<PaginatedResponse<AdminComment>>({
    queryKey: ['admin', 'comments'],
  });
}

function restoreComments(
  qc: ReturnType<typeof useQueryClient>,
  snapshots: CommentsSnapshot | undefined
) {
  if (!snapshots) return;
  for (const [key, data] of snapshots) {
    qc.setQueryData(key, data);
  }
}

function updateComments(
  qc: ReturnType<typeof useQueryClient>,
  updater: (comment: AdminComment) => AdminComment | null
) {
  const snapshots = qc.getQueriesData<PaginatedResponse<AdminComment>>({
    queryKey: ['admin', 'comments'],
  });

  for (const [key, data] of snapshots) {
    if (!data) continue;

    const nextComments = data.data
      .map(updater)
      .filter((comment): comment is AdminComment => comment !== null);

    qc.setQueryData<PaginatedResponse<AdminComment>>(key, {
      ...data,
      data: nextComments,
      meta: {
        ...data.meta,
        total:
          nextComments.length <= data.data.length
            ? data.meta.total - (data.data.length - nextComments.length)
            : data.meta.total,
      },
    });
  }

  return snapshots;
}

function useCommentStatusMutation(options: {
  mutationFn: (id: string) => Promise<unknown>;
  nextStatus: CommentStatus;
  successMessage: string;
  errorMessage: string;
}) {
  const qc = useQueryClient();

  return useMutation({
    mutationFn: options.mutationFn,
    onMutate: async (id: string) => {
      const snapshots = await snapshotComments(qc);
      updateComments(qc, (comment) =>
        comment.id === id ? { ...comment, status: options.nextStatus } : comment
      );
      return { snapshots };
    },
    onError: (_err, _id, context) => {
      restoreComments(qc, context?.snapshots);
      toast.error(options.errorMessage);
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['admin', 'comments'] });
    },
    onSuccess: () => {
      toast.success(options.successMessage);
    },
  });
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
    mutationFn: ({ id, status }: { id: string; status: CommentStatus }) =>
      apiPatch<AdminComment>(`/admin/comments/${id}/status`, { status }),
    onMutate: async ({ id, status }) => {
      const snapshots = await snapshotComments(qc);
      updateComments(qc, (comment) => (comment.id === id ? { ...comment, status } : comment));
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      restoreComments(qc, context?.snapshots);
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
  return useCommentStatusMutation({
    mutationFn: (id) => apiPost<void>(`/admin/comments/${id}/approve`, {}),
    nextStatus: 'approved',
    successMessage: 'Comentário aprovado.',
    errorMessage: 'Erro ao aprovar comentário.',
  });
}

/** Convenience alias for rejecting a comment (legacy path still works too). */
export function useRejectComment() {
  return useCommentStatusMutation({
    mutationFn: (id) => apiPost<void>(`/admin/comments/${id}/reject`, {}),
    nextStatus: 'rejected',
    successMessage: 'Comentário rejeitado.',
    errorMessage: 'Erro ao rejeitar comentário.',
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
      const snapshots = await snapshotComments(qc);
      updateComments(qc, (comment) => (comment.id === id ? null : comment));
      return { snapshots };
    },
    onError: (_err, _vars, context) => {
      restoreComments(qc, context?.snapshots);
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
