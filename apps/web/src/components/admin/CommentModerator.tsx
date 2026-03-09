'use client';

import type { AdminComment, CommentStatus } from '@portfolio/shared';
import {
  Calendar,
  Check,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Link2,
  MessageSquare,
  Pencil,
  Reply,
  Shield,
  Trash2,
  User,
  X,
} from 'lucide-react';
import { useState } from 'react';
import { TrustedHtml } from '@/components/shared/TrustedHtml';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import {
  useAdminComments,
  useAdminDeleteComment,
  useAdminEditCommentContent,
  useAdminReplyComment,
  useAdminUpdateCommentStatus,
  useApproveComment,
  useRejectComment,
} from '@/hooks/use-admin-queries';

const STATUS_LABELS: Record<CommentStatus, string> = {
  pending: 'Pendente',
  approved: 'Aprovado',
  rejected: 'Rejeitado',
};

const STATUS_TABS: { value: CommentStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pendentes', color: 'text-amber-400' },
  { value: 'approved', label: 'Aprovados', color: 'text-emerald-400' },
  { value: 'rejected', label: 'Rejeitados', color: 'text-red-400' },
];

function StatusBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status as CommentStatus] ?? status;
  const colorClass =
    status === 'approved'
      ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
      : status === 'rejected'
        ? 'bg-red-500/10 text-red-400 border-red-500/20'
        : 'bg-amber-500/10 text-amber-400 border-amber-500/20';
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${colorClass}`}
    >
      {label}
    </span>
  );
}

function CommentCardSkeleton() {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-5 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-4 w-32 bg-zinc-800" />
        <Skeleton className="h-5 w-20 bg-zinc-800 rounded-full" />
      </div>
      <Skeleton className="h-3 w-48 bg-zinc-800" />
      <Skeleton className="h-16 w-full bg-zinc-800" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 bg-zinc-800 rounded" />
        <Skeleton className="h-8 w-24 bg-zinc-800 rounded" />
      </div>
    </div>
  );
}

// â”€â”€â”€ Edit Content Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function EditContentDialog({ comment, onClose }: { comment: AdminComment; onClose: () => void }) {
  const [content, setContent] = useState(comment.content);
  const [reason, setReason] = useState('');
  const editMutation = useAdminEditCommentContent();

  function handleSubmit() {
    editMutation.mutate(
      { id: comment.id, content, reason: reason || undefined },
      { onSuccess: onClose }
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Editar comentário</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={6}
            className="bg-zinc-950 border-zinc-700 text-zinc-200 text-sm resize-none"
          />
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Motivo da edição (opcional)"
            rows={2}
            className="bg-zinc-950 border-zinc-700 text-zinc-400 text-sm resize-none placeholder:text-zinc-600"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-zinc-400 hover:text-zinc-200"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
            disabled={editMutation.isPending || !content.trim()}
            onClick={handleSubmit}
          >
            {editMutation.isPending ? 'Salvandoâ€¦' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// â”€â”€â”€ Reply Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ReplyDialog({ comment, onClose }: { comment: AdminComment; onClose: () => void }) {
  const [content, setContent] = useState('');
  const replyMutation = useAdminReplyComment();

  function handleSubmit() {
    replyMutation.mutate(
      { postId: comment.postId, parentCommentId: comment.id, content },
      { onSuccess: onClose }
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-zinc-100 flex items-center gap-2">
            <Reply className="h-4 w-4 text-emerald-400" />
            Responder como admin
          </DialogTitle>
        </DialogHeader>
        <p className="text-xs text-zinc-500 rounded bg-zinc-950/60 border border-zinc-800 px-3 py-2 italic line-clamp-3">
          "{comment.content}"
        </p>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Sua respostaâ€¦"
          rows={5}
          className="bg-zinc-950 border-zinc-700 text-zinc-200 text-sm resize-none placeholder:text-zinc-600"
        />
        <DialogFooter className="gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-zinc-400 hover:text-zinc-200"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 hover:bg-emerald-500 text-white"
            disabled={replyMutation.isPending || !content.trim()}
            onClick={handleSubmit}
          >
            {replyMutation.isPending ? 'Enviandoâ€¦' : 'Publicar resposta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// â”€â”€â”€ Delete Confirmation Dialog â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DeleteDialog({ comment, onClose }: { comment: AdminComment; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const deleteMutation = useAdminDeleteComment();

  function handleConfirm() {
    deleteMutation.mutate({ id: comment.id, reason: reason || undefined }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="bg-zinc-900 border-zinc-800 max-w-md">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Excluir comentário?</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-zinc-400">
          O comentário será removido (soft-delete) e não aparecerá publicamente. A ação pode ser
          rastreada por auditoria.
        </p>
        <Textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Motivo (opcional)"
          rows={2}
          className="bg-zinc-950 border-zinc-700 text-zinc-400 text-sm resize-none placeholder:text-zinc-600"
        />
        <DialogFooter className="gap-2">
          <Button
            size="sm"
            variant="ghost"
            className="text-zinc-400 hover:text-zinc-200"
            onClick={onClose}
          >
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={handleConfirm}
          >
            {deleteMutation.isPending ? 'Excluindoâ€¦' : 'Confirmar exclusão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// â”€â”€â”€ Comment Card â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function CommentCard({ comment }: { comment: AdminComment }) {
  const approve = useApproveComment();
  const reject = useRejectComment();
  const updateStatus = useAdminUpdateCommentStatus();

  const [showEdit, setShowEdit] = useState(false);
  const [showReply, setShowReply] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const isActing = approve.isPending || reject.isPending || updateStatus.isPending;

  const isDeleted = Boolean(comment.deletedAt);
  const isAdminReply = comment.authorRole === 'admin';

  return (
    <>
      {showEdit && <EditContentDialog comment={comment} onClose={() => setShowEdit(false)} />}
      {showReply && <ReplyDialog comment={comment} onClose={() => setShowReply(false)} />}
      {showDelete && <DeleteDialog comment={comment} onClose={() => setShowDelete(false)} />}

      <div
        className={`rounded-lg border p-5 space-y-3 transition-colors ${
          isDeleted
            ? 'border-red-900/30 bg-red-950/10 opacity-70'
            : isAdminReply
              ? 'border-emerald-500/20 bg-zinc-900/80'
              : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700'
        }`}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className={`flex h-7 w-7 items-center justify-center rounded-full shrink-0 ${
                isAdminReply ? 'bg-emerald-500/15 text-emerald-400' : 'bg-zinc-800 text-zinc-400'
              }`}
            >
              {isAdminReply ? <Shield className="h-3.5 w-3.5" /> : <User className="h-3.5 w-3.5" />}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-zinc-100 truncate flex items-center gap-1.5">
                {comment.authorName}
                {isAdminReply && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-emerald-500 border border-emerald-500/30 rounded px-1.5 py-0.5">
                    Admin
                  </span>
                )}
              </p>
              {comment.authorEmail && (
                <p className="text-xs text-zinc-500 truncate">{comment.authorEmail}</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isDeleted && (
              <span className="text-xs text-red-400 border border-red-900/40 rounded px-1.5 py-0.5">
                Excluído
              </span>
            )}
            <StatusBadge status={comment.status} />
          </div>
        </div>

        {/* Meta */}
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
            <span className="text-zinc-600 italic">
              Editado em{' '}
              {new Intl.DateTimeFormat('pt-BR', {
                day: '2-digit',
                month: 'short',
              }).format(new Date(comment.editedAt))}
              {comment.editReason && ` · ${comment.editReason}`}
            </span>
          )}
          {comment.deletedAt && (
            <span className="text-red-600/70 italic">
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

        {/* Content */}
        <div className="rounded-md bg-zinc-950/60 border border-zinc-800/50 p-3">
          <TrustedHtml
            html={comment.renderedContent}
            className="text-sm text-zinc-300 leading-relaxed prose prose-sm prose-invert max-w-none prose-p:my-1 line-clamp-6"
          />
        </div>

        {/* Actions */}
        {!isDeleted && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            {/* Approve */}
            {comment.status !== 'approved' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/10 border border-emerald-500/20"
                disabled={isActing}
                onClick={() => approve.mutate(comment.id)}
              >
                <Check className="h-3.5 w-3.5" />
                Aprovar
              </Button>
            )}
            {/* Reject */}
            {comment.status !== 'rejected' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 border border-red-500/20"
                disabled={isActing}
                onClick={() => reject.mutate(comment.id)}
              >
                <X className="h-3.5 w-3.5" />
                Rejeitar
              </Button>
            )}
            {/* Reset to pending */}
            {comment.status !== 'pending' && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 gap-1.5 text-amber-400 hover:text-amber-300 hover:bg-amber-500/10 border border-amber-500/20"
                disabled={isActing}
                onClick={() => updateStatus.mutate({ id: comment.id, status: 'pending' })}
              >
                Pendente
              </Button>
            )}

            <div className="flex-1" />

            {/* Reply */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              onClick={() => setShowReply(true)}
            >
              <Reply className="h-3.5 w-3.5" />
              Responder
            </Button>
            {/* Edit */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800"
              onClick={() => setShowEdit(true)}
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </Button>
            {/* Delete */}
            <Button
              size="sm"
              variant="ghost"
              className="h-8 gap-1.5 text-red-400/70 hover:text-red-400 hover:bg-red-500/10"
              onClick={() => setShowDelete(true)}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Excluir
            </Button>
          </div>
        )}
      </div>
    </>
  );
}

// â”€â”€â”€ Main Component â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export function CommentModerator() {
  const [status, setStatus] = useState<CommentStatus>('pending');
  const [showDeleted, setShowDeleted] = useState(false);
  const [page, setPage] = useState(1);
  const perPage = 10;

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
      {/* Status tabs */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-1 rounded-lg border border-zinc-800 bg-zinc-900/60 p-1">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value}
              type="button"
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
              className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                status === tab.value
                  ? `bg-zinc-800 ${tab.color}`
                  : 'text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          {/* Show deleted toggle */}
          <button
            type="button"
            onClick={() => {
              setShowDeleted((v) => !v);
              setPage(1);
            }}
            className={`flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors ${
              showDeleted
                ? 'border-red-900/50 bg-red-950/20 text-red-400'
                : 'border-zinc-800 bg-zinc-900 text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {showDeleted ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            {showDeleted ? 'Excluídos visíveis' : 'Ocultar excluídos'}
          </button>

          <span className="text-xs text-zinc-500 flex items-center gap-1.5">
            <MessageSquare className="h-3.5 w-3.5" />
            {meta ? `${meta.total} resultado${meta.total !== 1 ? 's' : ''}` : ''}
          </span>
        </div>
      </div>

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
            <CommentCard key={comment.id} comment={comment} />
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
