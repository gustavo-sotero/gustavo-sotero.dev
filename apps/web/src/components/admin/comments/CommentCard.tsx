'use client';

import type { AdminComment } from '@portfolio/shared';
import { Calendar, Check, Link2, Pencil, Reply, Shield, Trash2, User, X } from 'lucide-react';
import { TrustedHtml } from '@/components/shared/TrustedHtml';
import { Button } from '@/components/ui/button';
import {
  useAdminUpdateCommentStatus,
  useApproveComment,
  useRejectComment,
} from '@/hooks/admin/use-admin-comments';

const STATUS_LABELS = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
} as const;

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status as keyof typeof STATUS_LABELS] ?? status;
  const colorClass =
    status === 'approved'
      ? 'border-emerald-500/20 bg-emerald-500/10 text-emerald-400'
      : status === 'rejected'
        ? 'border-red-500/20 bg-red-500/10 text-red-400'
        : 'border-amber-500/20 bg-amber-500/10 text-amber-400';

  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}

interface CommentCardProps {
  comment: AdminComment;
  onReply: (comment: AdminComment) => void;
  onEdit: (comment: AdminComment) => void;
  onDelete: (comment: AdminComment) => void;
}

export function CommentCard({ comment, onReply, onEdit, onDelete }: CommentCardProps) {
  const approve = useApproveComment();
  const reject = useRejectComment();
  const updateStatus = useAdminUpdateCommentStatus();

  const isActing = approve.isPending || reject.isPending || updateStatus.isPending;
  const isDeleted = Boolean(comment.deletedAt);
  const isAdminReply = comment.authorRole === 'admin';

  return (
    <div
      className={`space-y-3 rounded-lg border p-5 transition-colors ${
        isDeleted
          ? 'border-red-900/30 bg-red-950/10 opacity-70'
          : isAdminReply
            ? 'border-emerald-500/20 bg-zinc-900/80'
            : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-2">
          <div
            className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
              isAdminReply ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            {isAdminReply ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
          </div>
          <div className="min-w-0">
            <p className="flex items-center gap-1.5 truncate text-sm font-medium text-zinc-100">
              {comment.authorName}
              {isAdminReply && (
                <span className="rounded border border-emerald-500/30 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-500">
                  Admin
                </span>
              )}
            </p>
            {comment.authorEmail && (
              <p className="truncate text-xs text-zinc-500">{comment.authorEmail}</p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isDeleted && (
            <span className="rounded border border-red-900/40 px-1.5 py-0.5 text-xs text-red-400">
              Excluído
            </span>
          )}
          <StatusBadge status={comment.status} />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
        {comment.postId && (
          <span className="flex items-center gap-1">
            <Link2 className="h-3 w-3" />
            {comment.postTitle ? comment.postTitle : `Post #${comment.postId}`}
          </span>
        )}
        {comment.parentCommentId && (
          <span className="flex items-center gap-1 text-zinc-600">
            <Reply className="h-3 w-3" />
            resposta
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {new Intl.DateTimeFormat('pt-BR', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          }).format(new Date(comment.createdAt))}
        </span>
        {comment.moderatedAt && (
          <span className="text-zinc-600">
            Moderado em{' '}
            {new Intl.DateTimeFormat('pt-BR', {
              day: '2-digit',
              month: 'short',
            }).format(new Date(comment.moderatedAt))}
            {comment.moderatedBy && ` · ${comment.moderatedBy}`}
          </span>
        )}
        {comment.editedAt && (
          <span className="italic text-zinc-600">
            Editado em{' '}
            {new Intl.DateTimeFormat('pt-BR', {
              day: '2-digit',
              month: 'short',
            }).format(new Date(comment.editedAt))}
            {comment.editReason && ` · ${comment.editReason}`}
          </span>
        )}
        {comment.deletedAt && (
          <span className="italic text-red-600/70">
            Excluído em{' '}
            {new Intl.DateTimeFormat('pt-BR', {
              day: '2-digit',
              month: 'short',
            }).format(new Date(comment.deletedAt))}
            {comment.deletedBy && ` · ${comment.deletedBy}`}
            {comment.deleteReason && ` · "${comment.deleteReason}"`}
          </span>
        )}
      </div>

      <div className="rounded-md border border-zinc-800/50 bg-zinc-950/60 p-3">
        <TrustedHtml
          html={comment.renderedContent}
          className="prose prose-invert prose-sm max-w-none line-clamp-6 text-sm leading-relaxed text-zinc-300 prose-p:my-1"
        />
      </div>

      {!isDeleted && (
        <div className="flex flex-wrap items-center gap-2 pt-1">
          {comment.status !== 'approved' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 border border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/10 hover:text-emerald-300"
              disabled={isActing}
              onClick={() => approve.mutate(comment.id)}
            >
              <Check className="h-3.5 w-3.5" />
              Aprovar
            </Button>
          )}
          {comment.status !== 'rejected' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 border border-red-500/20 text-red-400 hover:bg-red-500/10 hover:text-red-300"
              disabled={isActing}
              onClick={() => reject.mutate(comment.id)}
            >
              <X className="h-3.5 w-3.5" />
              Rejeitar
            </Button>
          )}
          {comment.status !== 'pending' && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 border border-amber-500/20 text-amber-400 hover:bg-amber-500/10 hover:text-amber-300"
              disabled={isActing}
              onClick={() => updateStatus.mutate({ id: comment.id, status: 'pending' })}
            >
              Pendente
            </Button>
          )}

          <div className="flex-1" />

          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => onReply(comment)}
          >
            <Reply className="h-3.5 w-3.5" />
            Responder
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100"
            onClick={() => onEdit(comment)}
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 gap-1.5 text-red-400/70 hover:bg-red-500/10 hover:text-red-400"
            onClick={() => onDelete(comment)}
          >
            <Trash2 className="h-3.5 w-3.5" />
            Excluir
          </Button>
        </div>
      )}
    </div>
  );
}
