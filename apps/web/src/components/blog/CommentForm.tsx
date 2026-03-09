'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
import { CornerDownRight, Loader2, MessageCircle, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiPost } from '@/lib/api';
import { env } from '@/lib/env';

const commentFormSchema = z.object({
  authorName: z.string().min(2, 'Nome deve ter pelo menos 2 caracteres').max(100),
  authorEmail: z.string().email('E-mail inválido'),
  content: z.string().min(3, 'Comentário deve ter pelo menos 3 caracteres').max(2000),
});

type CommentFormValues = z.infer<typeof commentFormSchema>;

interface CommentFormProps {
  postId: number;
  /** If set, this form submits a reply to this comment ID */
  parentCommentId?: string;
  /** Display name of the comment being replied to */
  replyingToName?: string;
  /** Called when user cancels the reply (removes reply context) */
  onCancelReply?: () => void;
  /** Called when a comment/reply is successfully submitted */
  onSuccess?: () => void;
}

export function CommentForm({
  postId,
  parentCommentId,
  replyingToName,
  onCancelReply,
  onSuccess,
}: CommentFormProps) {
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isDone, setIsDone] = useState(false);
  const turnstileRef = useRef<TurnstileInstance>(undefined);

  const isReplyMode = Boolean(parentCommentId);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<CommentFormValues>({
    resolver: zodResolver(commentFormSchema),
  });

  const onSubmit = async (values: CommentFormValues) => {
    if (!turnstileToken) {
      toast.error('Verificação de segurança necessária. Aguarde ou recarregue a página.');
      return;
    }

    try {
      await apiPost('/comments', {
        ...values,
        postId,
        ...(parentCommentId ? { parentCommentId } : {}),
        turnstileToken,
      });

      toast.success(
        isReplyMode
          ? 'Resposta enviada! Ela aparecerá após moderação.'
          : 'Comentário enviado! Ele aparecerá após moderação.'
      );
      reset();
      turnstileRef.current?.reset();
      setTurnstileToken(null);
      setIsDone(true);
      onSuccess?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Erro ao enviar comentário. Tente novamente.';
      toast.error(message);
      turnstileRef.current?.reset();
      setTurnstileToken(null);
    }
  };

  if (isDone) {
    return (
      <div className="flex flex-col items-center justify-center py-10 gap-3 text-center rounded-xl border border-emerald-500/20 bg-emerald-500/5">
        <MessageCircle className="h-8 w-8 text-emerald-400" />
        <p className="text-zinc-300 font-medium">
          {isReplyMode ? 'Resposta enviada com sucesso!' : 'Comentário enviado com sucesso!'}
        </p>
        <p className="text-zinc-500 text-sm">Ela aparecerá aqui após aprovação.</p>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setIsDone(false);
            onCancelReply?.();
          }}
          className="text-emerald-400 hover:text-emerald-300 mt-1"
        >
          {isReplyMode ? 'Outra resposta' : 'Enviar outro'}
        </Button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="space-y-4 p-5 rounded-xl border border-zinc-800 bg-zinc-900/40"
      noValidate
    >
      {/* Reply context banner */}
      {isReplyMode && replyingToName ? (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
          <span className="flex items-center gap-1.5 text-xs text-emerald-400">
            <CornerDownRight className="h-3 w-3" />
            Respondendo a <span className="font-semibold">{replyingToName}</span>
          </span>
          {onCancelReply && (
            <button
              type="button"
              onClick={onCancelReply}
              className="text-zinc-500 hover:text-zinc-300 transition-colors"
              aria-label="Cancelar resposta"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      ) : (
        <h3 className="text-base font-semibold text-zinc-200">Deixe um comentário</h3>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="comment-name" className="text-xs text-zinc-400">
            Nome <span aria-hidden="true">*</span>
          </Label>
          <Input
            id="comment-name"
            placeholder="Seu nome"
            aria-invalid={!!errors.authorName}
            aria-describedby={errors.authorName ? 'comment-name-error' : undefined}
            className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60"
            {...register('authorName')}
          />
          {errors.authorName && (
            <p id="comment-name-error" className="text-xs text-red-400" role="alert">
              {errors.authorName.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="comment-email" className="text-xs text-zinc-400">
            E-mail <span aria-hidden="true">*</span>
            <span className="text-zinc-600 font-normal ml-1">(não será exibido)</span>
          </Label>
          <Input
            id="comment-email"
            type="email"
            placeholder="seu@email.com"
            aria-invalid={!!errors.authorEmail}
            aria-describedby={errors.authorEmail ? 'comment-email-error' : undefined}
            className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60"
            {...register('authorEmail')}
          />
          {errors.authorEmail && (
            <p id="comment-email-error" className="text-xs text-red-400" role="alert">
              {errors.authorEmail.message}
            </p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="comment-content" className="text-xs text-zinc-400">
          {isReplyMode ? 'Resposta' : 'Comentário'} <span aria-hidden="true">*</span>
        </Label>
        <Textarea
          id="comment-content"
          placeholder={isReplyMode ? 'Escreva sua resposta...' : 'Escreva seu comentário...'}
          rows={4}
          aria-invalid={!!errors.content}
          aria-describedby={errors.content ? 'comment-content-error' : undefined}
          className="bg-zinc-900 border-zinc-700 text-zinc-100 placeholder:text-zinc-500 focus:border-emerald-500/60 resize-none"
          {...register('content')}
        />
        {errors.content && (
          <p id="comment-content-error" className="text-xs text-red-400" role="alert">
            {errors.content.message}
          </p>
        )}
      </div>

      {env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
        <Turnstile
          ref={turnstileRef}
          siteKey={env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
          onSuccess={setTurnstileToken}
          onExpire={() => setTurnstileToken(null)}
          options={{ theme: 'dark', size: 'normal' }}
        />
      )}

      <Button
        type="submit"
        disabled={isSubmitting || !turnstileToken}
        className="w-full sm:w-auto bg-emerald-500 text-zinc-950 hover:bg-emerald-400 disabled:opacity-50"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
            Enviando...
          </>
        ) : isReplyMode ? (
          'Enviar resposta'
        ) : (
          'Enviar comentário'
        )}
      </Button>
    </form>
  );
}
