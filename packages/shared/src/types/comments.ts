import type { CommentAuthorRole, CommentStatus } from '../constants/enums';

// ── Public types (safe to expose) ────────────────────────────────────────────

/** A single comment node in the public tree — no email, no ipHash. */
export interface PublicComment {
  id: string;
  postId: number;
  parentCommentId: string | null;
  authorName: string;
  authorRole: CommentAuthorRole;
  content: string;
  renderedContent: string;
  status: CommentStatus;
  createdAt: string;
  replies: PublicCommentNode[];
}

/** Alias for tree node — same shape, explicit name. */
export type PublicCommentNode = PublicComment;

/** Legacy alias — kept for backward compat in frontend code that uses Comment. */
export type Comment = PublicCommentNode;

// ── Admin types (includes private metadata) ──────────────────────────────────

export interface AdminComment {
  id: string;
  postId: number;
  postTitle?: string | null;
  parentCommentId: string | null;
  authorName: string;
  authorEmail: string;
  authorRole: CommentAuthorRole;
  content: string;
  renderedContent: string;
  status: CommentStatus;
  ipHash: string | null;
  createdAt: string;
  moderatedAt: string | null;
  moderatedBy: string | null;
  editedAt: string | null;
  editedBy: string | null;
  editReason: string | null;
  deletedAt: string | null;
  deletedBy: string | null;
  deleteReason: string | null;
}

// ── Input types (request DTOs) ───────────────────────────────────────────────

export interface CreateCommentInput {
  postId: number;
  parentCommentId?: string;
  authorName: string;
  authorEmail: string;
  content: string;
  turnstileToken: string;
}
