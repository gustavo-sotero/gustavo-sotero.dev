'use client';

import type { AdminComment } from '@portfolio/shared/types/comments';
import { Reply } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import {
  useAdminDeleteComment,
  useAdminEditCommentContent,
  useAdminReplyComment,
} from '@/hooks/admin/use-admin-comments';
import type { CommentDialogState } from './useCommentModerationDialog';

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Editar comentário</DialogTitle>
          <DialogDescription className="text-zinc-400">
            Atualize o conteúdo do comentário e, se necessário, registre um motivo para auditoria.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Textarea
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={6}
            className="resize-none bg-zinc-950 text-sm text-zinc-200"
          />
          <Textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="Motivo da edição (opcional)"
            rows={2}
            className="resize-none bg-zinc-950 text-sm text-zinc-400 placeholder:text-zinc-600"
          />
        </div>
        <DialogFooter className="gap-2">
          <Button size="sm" variant="ghost" className="text-zinc-400" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            disabled={editMutation.isPending || !content.trim()}
            onClick={handleSubmit}
          >
            {editMutation.isPending ? 'Salvando...' : 'Salvar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

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
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-lg border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-zinc-100">
            <Reply className="h-4 w-4 text-emerald-400" />
            Responder como admin
          </DialogTitle>
          <DialogDescription className="text-zinc-400">
            Sua resposta ficará pública no post como um comentário do administrador.
          </DialogDescription>
        </DialogHeader>
        <p className="line-clamp-3 rounded border border-zinc-800 bg-zinc-950/60 px-3 py-2 text-xs italic text-zinc-500">
          "{comment.content}"
        </p>
        <Textarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Sua resposta..."
          rows={5}
          className="resize-none bg-zinc-950 text-sm text-zinc-200 placeholder:text-zinc-600"
        />
        <DialogFooter className="gap-2">
          <Button size="sm" variant="ghost" className="text-zinc-400" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            className="bg-emerald-600 text-white hover:bg-emerald-500"
            disabled={replyMutation.isPending || !content.trim()}
            onClick={handleSubmit}
          >
            {replyMutation.isPending ? 'Enviando...' : 'Publicar resposta'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDialog({ comment, onClose }: { comment: AdminComment; onClose: () => void }) {
  const [reason, setReason] = useState('');
  const deleteMutation = useAdminDeleteComment();

  function handleConfirm() {
    deleteMutation.mutate({ id: comment.id, reason: reason || undefined }, { onSuccess: onClose });
  }

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md border-zinc-800 bg-zinc-900">
        <DialogHeader>
          <DialogTitle className="text-zinc-100">Excluir comentário?</DialogTitle>
          <DialogDescription className="text-zinc-400">
            O comentário será ocultado publicamente com soft delete e a ação ficará auditável.
          </DialogDescription>
        </DialogHeader>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Motivo (opcional)"
          rows={2}
          className="resize-none bg-zinc-950 text-sm text-zinc-400 placeholder:text-zinc-600"
        />
        <DialogFooter className="gap-2">
          <Button size="sm" variant="ghost" className="text-zinc-400" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            size="sm"
            variant="destructive"
            disabled={deleteMutation.isPending}
            onClick={handleConfirm}
          >
            {deleteMutation.isPending ? 'Excluindo...' : 'Confirmar exclusão'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

interface CommentModerationDialogsProps {
  dialogState: CommentDialogState;
  onClose: () => void;
}

export function CommentModerationDialogs({ dialogState, onClose }: CommentModerationDialogsProps) {
  if (dialogState.type === 'edit') {
    return <EditContentDialog comment={dialogState.comment} onClose={onClose} />;
  }

  if (dialogState.type === 'reply') {
    return <ReplyDialog comment={dialogState.comment} onClose={onClose} />;
  }

  if (dialogState.type === 'delete') {
    return <DeleteDialog comment={dialogState.comment} onClose={onClose} />;
  }

  return null;
}
