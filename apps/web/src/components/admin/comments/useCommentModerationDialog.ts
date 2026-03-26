import type { AdminComment } from '@portfolio/shared';
import { useState } from 'react';

export type CommentDialogState =
  | { type: 'none' }
  | { type: 'edit'; comment: AdminComment }
  | { type: 'reply'; comment: AdminComment }
  | { type: 'delete'; comment: AdminComment };

export function useCommentModerationDialog() {
  const [dialogState, setDialogState] = useState<CommentDialogState>({ type: 'none' });

  return {
    dialogState,
    closeDialog: () => setDialogState({ type: 'none' }),
    openEditDialog: (comment: AdminComment) => setDialogState({ type: 'edit', comment }),
    openReplyDialog: (comment: AdminComment) => setDialogState({ type: 'reply', comment }),
    openDeleteDialog: (comment: AdminComment) => setDialogState({ type: 'delete', comment }),
  };
}
