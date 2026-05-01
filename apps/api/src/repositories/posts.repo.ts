import { posts, postTags, tags } from '@portfolio/shared/db/schema';
import { and, count, eq, exists, isNull, lte, type SQL, sql } from 'drizzle-orm';
import { db } from '../config/db';
import {
  buildPaginationMeta,
  parsePagination,
  type TotalCountQueryOptions,
} from '../lib/pagination';
import type { DbOrTx } from './tags.repo';

export function publicPostVisibilityClauses(postTable: typeof posts = posts): SQL[] {
  return [
    eq(postTable.status, 'published'),
    isNull(postTable.deletedAt),
    lte(postTable.publishedAt, sql`now()`),
  ];
}

export interface PostFilters {
  status?: 'draft' | 'published' | 'scheduled';
  tag?: string;
  sort?: 'manual' | 'recent';
  page?: string | number;
  perPage?: string | number;
}

function resolvePostListState(filters: PostFilters, adminMode: boolean) {
  const { page, perPage, offset, limit } = parsePagination({
    page: filters.page,
    perPage: filters.perPage,
  });

  const conditions: SQL[] = [];

  if (!adminMode) {
    conditions.push(...publicPostVisibilityClauses());
  } else {
    conditions.push(isNull(posts.deletedAt));
    if (filters.status) {
      conditions.push(eq(posts.status, filters.status));
    }
  }

  if (filters.tag) {
    conditions.push(
      exists(
        db
          .select({ one: sql`1` })
          .from(postTags)
          .innerJoin(tags, eq(postTags.tagId, tags.id))
          .where(and(eq(postTags.postId, posts.id), eq(tags.slug, filters.tag)))
      )
    );
  }

  return {
    page,
    perPage,
    offset,
    limit,
    where: conditions.length > 0 ? and(...conditions) : undefined,
  };
}

async function queryPostRows(filters: PostFilters, adminMode: boolean) {
  const { page, perPage, offset, limit, where } = resolvePostListState(filters, adminMode);
  const rows = await db.query.posts.findMany({
    where,
    orderBy:
      filters.sort === 'manual'
        ? sql`${posts.order} ASC, ${posts.publishedAt} DESC NULLS LAST, ${posts.createdAt} DESC`
        : sql`${posts.publishedAt} DESC NULLS LAST, ${posts.createdAt} DESC`,
    limit,
    offset,
    with: {
      tags: {
        with: { tag: true },
      },
    },
  });

  return { rows, page, perPage, where };
}

/**
 * Find a published post by ID for public consumption.
 * Returns `{ id, title }` or `null` when not found or not publicly visible.
 */
export async function findPublicPostById(
  id: number
): Promise<{ id: number; title: string } | null> {
  const [row] = await db
    .select({ id: posts.id, title: posts.title })
    .from(posts)
    .where(and(eq(posts.id, id), ...publicPostVisibilityClauses()))
    .limit(1);
  return row ?? null;
}

/**
 * List posts for public consumption (published + not deleted)
 * or admin (all statuses, filter optional).
 */
export async function findManyPosts(
  filters: PostFilters,
  adminMode = false,
  options: TotalCountQueryOptions = {}
) {
  const { rows, page, perPage, where } = await queryPostRows(filters, adminMode);

  if (options.includeTotal === false) {
    return {
      data: rows,
      meta: buildPaginationMeta(rows.length, page, perPage),
    };
  }

  const countResult = await db.select({ total: count() }).from(posts).where(where);
  const total = countResult[0]?.total ?? 0;
  return { data: rows, meta: buildPaginationMeta(total, page, perPage) };
}

/** Find a post by slug. Returns with tags (public: only approved comments excluded here). */
export async function findPostBySlug(slug: string, adminMode = false) {
  const conditions: SQL[] = [eq(posts.slug, slug)];
  if (adminMode) {
    conditions.push(isNull(posts.deletedAt));
  } else {
    conditions.push(...publicPostVisibilityClauses());
  }

  const row = await db.query.posts.findFirst({
    where: and(...conditions),
    with: {
      tags: {
        with: { tag: true },
      },
    },
  });

  return row ?? null;
}

/**
 * Find all posts that are scheduled and due for publication.
 * Used by the worker's postPublish job.
 */
export async function findScheduledPostsDue() {
  return db
    .select({ id: posts.id, slug: posts.slug })
    .from(posts)
    .where(
      and(
        eq(posts.status, 'scheduled'),
        isNull(posts.deletedAt),
        lte(posts.scheduledAt, sql`now()`)
      )
    );
}

/** Create a new post. */
export async function createPost(data: typeof posts.$inferInsert, dbOrTx: DbOrTx = db) {
  const [row] = await dbOrTx.insert(posts).values(data).returning();
  return row;
}

/** Update a post by ID. */
export async function updatePost(
  id: number,
  data: Partial<typeof posts.$inferInsert>,
  dbOrTx: DbOrTx = db
) {
  const [row] = await dbOrTx
    .update(posts)
    .set({ ...data, updatedAt: new Date() })
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .returning();
  return row ?? null;
}

/** Soft-delete a post by ID. */
export async function softDeletePost(id: number) {
  const [row] = await db
    .update(posts)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(posts.id, id), isNull(posts.deletedAt)))
    .returning({ id: posts.id });
  return row ?? null;
}
