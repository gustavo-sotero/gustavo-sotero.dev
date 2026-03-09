import { comments } from '@portfolio/shared/db/schema';
import type { PublicCommentNode } from '@portfolio/shared/types/comments';
import { and, asc, count, eq, isNotNull, isNull, type SQL, sql } from 'drizzle-orm';
import { db } from '../config/db';
import { buildPaginationMeta, parsePagination } from '../lib/pagination';

// ── Filters ─────────────────────────────────────────────────────────────────

export interface CommentFilters {
  postId?: number;
  status?: 'pending' | 'approved' | 'rejected';
  deleted?: boolean;
  page?: string | number;
  perPage?: string | number;
}

// ── Tree builder ─────────────────────────────────────────────────────────────

/**
 * Build a nested comment tree from a flat rows array.
 * Single-pass O(n) via a Map — no recursive DB queries.
 * Root nodes (parentCommentId == null) are returned sorted by createdAt.
 */
export function buildCommentTree(
  rows: Array<{
    id: string;
    postId: number;
    parentCommentId: string | null;
    authorName: string;
    authorRole: 'guest' | 'admin';
    content: string;
    renderedContent: string;
    status: 'pending' | 'approved' | 'rejected';
    createdAt: Date;
  }>
): PublicCommentNode[] {
  const map = new Map<string, PublicCommentNode>();
  const roots: PublicCommentNode[] = [];

  for (const row of rows) {
    map.set(row.id, {
      id: row.id,
      postId: row.postId,
      parentCommentId: row.parentCommentId,
      authorName: row.authorName,
      authorRole: row.authorRole,
      content: row.content,
      renderedContent: row.renderedContent,
      status: row.status,
      createdAt: row.createdAt.toISOString(),
      replies: [],
    });
  }

  for (const node of map.values()) {
    if (node.parentCommentId === null) {
      roots.push(node);
    } else {
      const parent = map.get(node.parentCommentId);
      if (parent) {
        parent.replies.push(node);
      } else {
        // Parent not found (deleted) — promote to root
        roots.push(node);
      }
    }
  }

  const sortByCreatedAt = (nodes: PublicCommentNode[]) => {
    nodes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    for (const node of nodes) {
      if (node.replies.length > 0) {
        sortByCreatedAt(node.replies);
      }
    }
  };

  sortByCreatedAt(roots);

  return roots;
}

// ── Public reads ─────────────────────────────────────────────────────────────

/**
 * Returns a nested tree of approved, non-deleted comments for a post.
 * Used in the public post detail payload.
 */
export async function findApprovedCommentsByPostId(postId: number): Promise<PublicCommentNode[]> {
  const rows = await db
    .select({
      id: comments.id,
      postId: comments.postId,
      parentCommentId: comments.parentCommentId,
      authorName: comments.authorName,
      authorRole: comments.authorRole,
      content: comments.content,
      renderedContent: comments.renderedContent,
      status: comments.status,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .where(
      and(eq(comments.postId, postId), eq(comments.status, 'approved'), isNull(comments.deletedAt))
    )
    .orderBy(asc(comments.createdAt));

  return buildCommentTree(rows);
}

// ── Admin reads ─────────────────────────────────────────────────────────────

/** List comments for admin with optional filters and pagination. */
export async function findManyComments(filters: CommentFilters = {}) {
  const { page, perPage, offset, limit } = parsePagination({
    page: filters.page,
    perPage: filters.perPage,
  });

  const conditions: SQL[] = [];

  if (filters.status) {
    conditions.push(eq(comments.status, filters.status));
  }

  if (filters.postId !== undefined) {
    conditions.push(eq(comments.postId, filters.postId));
  }

  // deleted=true → only soft-deleted; default → non-deleted only
  if (filters.deleted === true) {
    conditions.push(isNotNull(comments.deletedAt));
  } else {
    conditions.push(isNull(comments.deletedAt));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(comments).where(where),
    db
      .select()
      .from(comments)
      .where(where)
      .orderBy(asc(comments.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: buildPaginationMeta(total, page, perPage) };
}

/** Find a single comment by ID (includes deleted — for admin). */
export async function findCommentById(id: string) {
  const [row] = await db.select().from(comments).where(eq(comments.id, id)).limit(1);
  return row ?? null;
}

// ── Write operations ─────────────────────────────────────────────────────────

/** Insert a new comment row. */
export async function createComment(data: typeof comments.$inferInsert) {
  const [row] = await db.insert(comments).values(data).returning();
  return row;
}

/**
 * Update comment status — reversible across all states.
 * Records moderation audit metadata.
 */
export async function updateCommentStatus(
  id: string,
  status: 'pending' | 'approved' | 'rejected',
  moderatedBy: string
) {
  const [row] = await db
    .update(comments)
    .set({ status, moderatedAt: new Date(), moderatedBy })
    .where(eq(comments.id, id))
    .returning();
  return row ?? null;
}

/**
 * Update comment content (admin edit).
 * Caller must re-render markdown before calling this.
 */
export async function updateCommentContent(
  id: string,
  content: string,
  renderedContent: string,
  editedBy: string,
  editReason?: string
) {
  const [row] = await db
    .update(comments)
    .set({
      content,
      renderedContent,
      editedAt: new Date(),
      editedBy,
      editReason: editReason ?? null,
    })
    .where(eq(comments.id, id))
    .returning();
  return row ?? null;
}

/**
 * Soft-delete a comment.
 * Preserves the row for audit + retention-job compatibility.
 */
export async function softDeleteComment(id: string, deletedBy: string, deleteReason?: string) {
  const [row] = await db
    .update(comments)
    .set({
      deletedAt: new Date(),
      deletedBy,
      deleteReason: deleteReason ?? null,
    })
    .where(eq(comments.id, id))
    .returning();
  return row ?? null;
}

/**
 * Anonymize author_email for comments older than the given date.
 * Replaces the email with a placeholder while preserving the comment itself.
 * Returns the number of anonymized rows.
 */
export async function anonymizeOldCommentEmails(olderThan: Date): Promise<number> {
  const placeholder = 'anonymized@removed.local';
  const result = await db.execute<{ count: number }>(sql`
    UPDATE comments
    SET author_email = ${placeholder}
    WHERE created_at < ${olderThan}
      AND author_email != ${placeholder}
    RETURNING 1
  `);
  return result.length;
}
