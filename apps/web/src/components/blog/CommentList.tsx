import type { PublicCommentNode } from '@portfolio/shared';
import { CornerDownRight, MessageCircle, Shield } from 'lucide-react';
import { TrustedHtml } from '@/components/shared/TrustedHtml';
import { formatDateBR } from '@/lib/utils';

interface CommentListProps {
  comments: PublicCommentNode[];
  onReply?: (commentId: string, authorName: string) => void;
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

interface CommentNodeProps {
  comment: PublicCommentNode;
  depth: number;
  onReply?: (commentId: string, authorName: string) => void;
}

function CommentNode({ comment, depth, onReply }: CommentNodeProps) {
  const isAdmin = comment.authorRole === 'admin';
  // Cap visual indent at depth 4 to prevent layout overflow
  const clampedDepth = Math.min(depth, 4);

  return (
    <li className="group flex flex-col gap-1">
      <div
        className={[
          'flex gap-3 p-4 rounded-xl border transition-colors',
          isAdmin
            ? 'border-emerald-500/30 bg-emerald-500/5 hover:border-emerald-500/50'
            : 'border-zinc-800 bg-zinc-900/40 hover:border-zinc-700',
        ]
          .filter(Boolean)
          .join(' ')}
        style={clampedDepth > 0 ? { marginLeft: `${clampedDepth}rem` } : undefined}
      >
        {/* Avatar */}
        <div
          aria-hidden="true"
          className={[
            'shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold font-mono',
            isAdmin
              ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
              : 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-400',
          ].join(' ')}
        >
          {isAdmin ? <Shield className="h-3.5 w-3.5" /> : getInitials(comment.authorName)}
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-zinc-200">{comment.authorName}</span>
            {isAdmin && (
              <span className="inline-flex items-center gap-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400">
                <Shield className="h-2.5 w-2.5" />
                Autor
              </span>
            )}
            <time dateTime={comment.createdAt} className="text-xs text-zinc-500 font-mono">
              {formatDateBR(comment.createdAt)}
            </time>
          </div>

          {comment.renderedContent ? (
            <TrustedHtml
              html={comment.renderedContent}
              className="text-sm text-zinc-400 leading-relaxed prose prose-sm prose-zinc dark:prose-invert max-w-none prose-a:text-emerald-400 prose-a:no-underline hover:prose-a:underline"
            />
          ) : null}

          {onReply && (
            <button
              type="button"
              onClick={() => onReply(comment.id, comment.authorName)}
              className="flex items-center gap-1 text-xs text-zinc-500 hover:text-emerald-400 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 mt-0.5"
              aria-label={`Responder a ${comment.authorName}`}
            >
              <CornerDownRight className="h-3 w-3" />
              Responder
            </button>
          )}
        </div>
      </div>

      {/* Replies */}
      {(comment.replies?.length ?? 0) > 0 && (
        <ul className="space-y-2" aria-label={`Respostas a ${comment.authorName}`}>
          {comment.replies.map((reply) => (
            <CommentNode key={reply.id} comment={reply} depth={depth + 1} onReply={onReply} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function CommentList({ comments, onReply }: CommentListProps) {
  if (comments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
        <MessageCircle className="h-8 w-8 text-zinc-700" />
        <p className="text-zinc-500 text-sm font-mono">{'// nenhum comentário ainda'}</p>
        <p className="text-zinc-600 text-xs">Seja o primeiro a comentar!</p>
      </div>
    );
  }

  return (
    <ul className="space-y-4" aria-label="Comentários">
      {comments.map((comment) => (
        <CommentNode key={comment.id} comment={comment} depth={0} onReply={onReply} />
      ))}
    </ul>
  );
}
