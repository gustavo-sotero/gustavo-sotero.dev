'use client';

import type { PaginatedResponse } from '@portfolio/shared/types/api';
import type { PublicCommentNode } from '@portfolio/shared/types/comments';
import { Loader2, MessageCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { apiGetPaginated } from '@/lib/api';
import { Button } from '../ui/button';
import { CommentForm } from './CommentForm';
import { CommentList } from './CommentList';

const COMMENTS_PER_PAGE = 20;

interface CommentsSectionProps {
  postId: number;
  postSlug: string;
  initialComments: PublicCommentNode[];
  /** Total approved comment count returned by the post detail API. */
  commentCount?: number;
}

/**
 * Client Component that manages the reply state between CommentList and CommentForm.
 * Supports lazy-loading additional comments beyond the initial preview.
 */
export function CommentsSection({
  postId,
  postSlug,
  initialComments,
  commentCount = 0,
}: CommentsSectionProps) {
  const router = useRouter();
  const [replyTarget, setReplyTarget] = useState<{ id: string; name: string } | null>(null);
  const [loadedComments, setLoadedComments] = useState<PublicCommentNode[]>(initialComments);
  const [loadingMore, setLoadingMore] = useState(false);
  // Track the next page to fetch (page 1 is already in the initial preview, start at 2)
  const [nextPage, setNextPage] = useState(2);
  const [hasMore, setHasMore] = useState(countNodes(initialComments) < commentCount);

  const handleReply = (commentId: string, authorName: string) => {
    setReplyTarget({ id: commentId, name: authorName });
    requestAnimationFrame(() => {
      document
        .getElementById('comment-form-anchor')
        ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  };

  const handleCancelReply = () => {
    setReplyTarget(null);
  };

  const handleSuccess = () => {
    setReplyTarget(null);
    router.refresh();
  };

  async function loadMoreComments() {
    setLoadingMore(true);
    try {
      const res = await apiGetPaginated<PublicCommentNode>(
        `/posts/${postSlug}/comments?page=${nextPage}&perPage=${COMMENTS_PER_PAGE}`
      );
      const page = res as PaginatedResponse<PublicCommentNode>;
      setLoadedComments((prev) => [...prev, ...page.data]);
      setNextPage((p) => p + 1);
      const loadedFlat = countNodes([...loadedComments, ...page.data]);
      setHasMore(loadedFlat < commentCount);
    } catch {
      // Non-fatal — user can retry
    } finally {
      setLoadingMore(false);
    }
  }

  const displayCount = commentCount > 0 ? commentCount : countNodes(loadedComments);

  return (
    <section aria-labelledby="comments-heading" className="space-y-8">
      <h2 id="comments-heading" className="text-xl font-bold text-zinc-100 flex items-center gap-2">
        <MessageCircle className="h-5 w-5 text-emerald-500" />
        Comentários
        {displayCount > 0 && (
          <span className="text-sm font-normal text-zinc-500 font-mono">({displayCount})</span>
        )}
      </h2>

      <CommentList comments={loadedComments} onReply={handleReply} />

      {hasMore && (
        <div className="flex justify-center pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={loadMoreComments}
            disabled={loadingMore}
            className="border-zinc-700 text-zinc-400 hover:text-zinc-100"
          >
            {loadingMore ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Carregando...
              </>
            ) : (
              'Carregar mais comentários'
            )}
          </Button>
        </div>
      )}

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
