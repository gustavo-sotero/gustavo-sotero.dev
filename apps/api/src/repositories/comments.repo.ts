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
 *
 * Callers must supply rows pre-ordered by `createdAt ASC` (guaranteed by every
 * query that feeds this function via `orderBy(asc(comments.createdAt))`).
 * Map iteration preserves insertion order, so roots and replies are already in
 * chronological order after the single pass — no secondary sort is required.
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
        // Parent not found (deleted or filtered out) — promote to root.
        // Because rows arrive in createdAt ASC order and a parent is always
        // created before its reply, the orphan is appended in the correct
        // chronological position without any secondary sort.
        roots.push(node);
      }
    }
  }

  return roots;
}

// ── Public reads ─────────────────────────────────────────────────────────────

/** Shared column projection for public comment rows. */
const publicCommentColumns = {
  id: comments.id,
  postId: comments.postId,
  parentCommentId: comments.parentCommentId,
  authorName: comments.authorName,
  authorRole: comments.authorRole,
  content: comments.content,
  renderedContent: comments.renderedContent,
  status: comments.status,
  createdAt: comments.createdAt,
} as const;

/**
 * Returns the total count of approved, non-deleted comments for a post.
 * Used alongside the limited initial preview in the post detail payload.
 */
export async function countApprovedCommentsByPostId(postId: number): Promise<number> {
  const [result] = await db
    .select({ total: count() })
    .from(comments)
    .where(
      and(eq(comments.postId, postId), eq(comments.status, 'approved'), isNull(comments.deletedAt))
    );
  return result?.total ?? 0;
}

/**
 * Returns a nested tree of approved, non-deleted comments for a post.
 * Capped at `limit` rows (default 30) for the post detail initial preview.
 * Use `findPaginatedApprovedCommentsByPostId` for subsequent pages.
 */
export async function findApprovedCommentsByPostId(
  postId: number,
  limit = 30
): Promise<PublicCommentNode[]> {
  const rows = await db
    .select(publicCommentColumns)
    .from(comments)
    .where(
      and(eq(comments.postId, postId), eq(comments.status, 'approved'), isNull(comments.deletedAt))
    )
    .orderBy(asc(comments.createdAt))
    .limit(limit);

  return buildCommentTree(rows);
}

/**
 * Returns a paginated page of approved, non-deleted comments for a post,
 * assembled into a tree from the page's flat rows.
 *
 * Callers must pass a `page` ≥ 1. The first page overlaps with the
 * initial detail preview; consumers should start from page 2 when using
 * the detail payload's initial comments.
 */
export async function findPaginatedApprovedCommentsByPostId(
  postId: number,
  page: number,
  perPage: number
): Promise<{ data: PublicCommentNode[]; meta: ReturnType<typeof buildPaginationMeta> }> {
  const { offset, limit } = parsePagination({ page, perPage });
  const where = and(
    eq(comments.postId, postId),
    eq(comments.status, 'approved'),
    isNull(comments.deletedAt)
  );

  const [countResult, rows] = await Promise.all([
    db.select({ total: count() }).from(comments).where(where),
    db
      .select(publicCommentColumns)
      .from(comments)
      .where(where)
      .orderBy(asc(comments.createdAt))
      .limit(limit)
      .offset(offset),
  ]);

  const total = countResult[0]?.total ?? 0;
  return {
    data: buildCommentTree(rows),
    meta: buildPaginationMeta(total, page, perPage),
  };
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
