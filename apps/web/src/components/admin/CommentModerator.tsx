'use client';

import type { CommentStatus } from '@portfolio/shared';
import { ChevronLeft, ChevronRight, MessageSquare } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useAdminComments } from '@/hooks/admin/use-admin-comments';
import { CommentCard } from './comments/CommentCard';
import { CommentCardSkeleton } from './comments/CommentCardSkeleton';
import { CommentFilterBar } from './comments/CommentFilterBar';
import { CommentModerationDialogs } from './comments/CommentModerationDialogs';
import { useCommentModerationDialog } from './comments/useCommentModerationDialog';

const STATUS_LABELS: Record<CommentStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

export function CommentModerator() {
  const [status, setStatus] = useState<CommentStatus>('pending');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;
  const { dialogState, closeDialog, openDeleteDialog, openEditDialog, openReplyDialog } =
    useCommentModerationDialog();

  const { data, isLoading, isError, refetch } = useAdminComments({
    status,
    page,
    perPage,
    deleted: showDeleted ? true : undefined,
  });

  const comments = data?.data ?? [];
  const meta = data?.meta;
  const totalPages = meta?.totalPages ?? 1;

  return (
    <div className="space-y-5">
      <CommentModerationDialogs dialogState={dialogState} onClose={closeDialog} />

      <CommentFilterBar
        status={status}
        onStatusChange={(s) => {
          setStatus(s);
          setPage(1);
        }}
        showDeleted={showDeleted}
        onToggleDeleted={() => {
          setShowDeleted((v) => !v);
          setPage(1);
        }}
        total={meta?.total}
      />

      {/* List */}
      {isLoading ? (
        <div className="space-y-4">
          {(['cs1', 'cs2', 'cs3'] as const).map((sk) => (
            <CommentCardSkeleton key={sk} />
          ))}
        </div>
      ) : isError ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-zinc-800 py-16 text-center">
          <p className="text-sm text-zinc-500">Falha ao carregar comentários</p>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => refetch()}
            className="text-xs text-zinc-400"
          >
            Tentar novamente
          </Button>
        </div>
      ) : comments.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-zinc-800 border-dashed py-16 text-center">
          <MessageSquare className="h-8 w-8 text-zinc-700" />
          <p className="text-sm text-zinc-500">
            {status === 'pending'
              ? 'Nenhum comentário pendente de moderação'
              : `Nenhum comentário ${STATUS_LABELS[status]?.toLowerCase()}`}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map((comment) => (
            <CommentCard
              key={comment.id}
              comment={comment}
              onReply={openReplyDialog}
              onEdit={openEditDialog}
              onDelete={openDeleteDialog}
            />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-zinc-500">
            Página {page} de {totalPages}
          </p>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
              disabled={page <= 1}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-zinc-400 hover:text-zinc-100"
              disabled={page >= totalPages}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
