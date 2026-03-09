'use client';

import type { PublicCommentNode } from '@portfolio/shared';
import { MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useState } from 'react';
import { CommentForm } from './CommentForm';
import { CommentList } from './CommentList';

interface CommentsSectionProps {
  postId: number;
  initialComments: PublicCommentNode[];
}

/**
 * Client Component that manages the reply state between CommentList and CommentForm.
 * The Server Component (blog detail page) renders this with SSR-fetched comments.
 */
export function CommentsSection({ postId, initialComments }: CommentsSectionProps) {
  const router = useRouter();
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);

  const handleReply = useCallback((commentId: string, authorName: string) => {
    setReplyTarget({ id: commentId, name: authorName });
    // Scroll the form into view smoothly
    requestAnimationFrame(() => {
      document
        .getElementById('comment-form-anchor')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }, []);

  const handleCancelReply = useCallback(() => {
    setReplyTarget(null);
  }, []);

  const handleSuccess = useCallback(() => {
    setReplyTarget(null);
    router.refresh();
  }, [router]);

  const commentCount = countNodes(initialComments);

  return (
    <section aria-labelledby="comments-heading" className="space-y-8">
      <h2 id="comments-heading" className="text-xl font-bold text-zinc-100 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-emerald-500" />
        Comentários
        {commentCount > 0 && (
          <span className="text-sm font-normal text-zinc-500 font-mono">({commentCount})</span>
        )}
      </h2>

      <CommentList comments={initialComments} onReply={handleReply} />

      <div id="comment-form-anchor" className="pt-4">
        <CommentForm
          postId={postId}
          parentCommentId={replyTarget?.id}
          replyingToName={replyTarget?.name}
          onCancelReply={handleCancelReply}
          onSuccess={handleSuccess}
        />
      </div>
    </section>
  );
}

/** Count total nodes in a tree (root + all replies). */
function countNodes(nodes: PublicCommentNode[] | undefined | null): number {
  if (!nodes) return 0;
  let count = nodes.length;
  for (const node of nodes) {
    count += countNodes(node.replies);
  }
  return count;
}
