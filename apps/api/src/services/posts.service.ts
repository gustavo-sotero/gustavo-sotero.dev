/**
 * Service layer for posts.
 *
 * Handles business logic: slug generation, Markdown rendering, cache
 * invalidation, and tag synchronization. Delegates persistence to the
 * repository layer.
 */

import { OutboxEventType } from '@portfolio/shared/constants/enums';
import { outbox, posts } from '@portfolio/shared/db/schema';
import type { CreatePostInput, UpdatePostInput } from '@portfolio/shared/schemas/posts';
import { and, eq } from 'drizzle-orm';
import { db } from '../config/db';
import { cached, invalidateGroup } from '../lib/cache';
import { ConflictError } from '../lib/errors';
import { renderMarkdown } from '../lib/markdown';
import { flattenPivotTags, resolveSlugTaken } from '../lib/pivotHelpers';
import { cancelScheduledPostPublish } from '../lib/queues';
import { ensureUniqueSlug, generateSlug } from '../lib/slug';
import { assertTagsExist, normalizeTagIds } from '../lib/tagValidation';
import { findApprovedCommentsByPostId } from '../repositories/comments.repo';
import {
  createPost,
  findManyPosts,
  findPostBySlug,
  softDeletePost,
  updatePost,
} from '../repositories/posts.repo';
import { syncPostTagsInTx } from '../repositories/tags.repo';

// ── Cache TTLs ────────────────────────────────────────────────────────────────

const LIST_TTL = 300; // 5 minutes
const DETAIL_TTL = 3600; // 1 hour

// ── Slug uniqueness check ─────────────────────────────────────────────────────

async function postSlugTaken(slug: string, excludeId?: number): Promise<boolean> {
  const rows = await db.select({ id: posts.id }).from(posts).where(eq(posts.slug, slug)).limit(1);
  return resolveSlugTaken(rows, excludeId);
}

// ── Service methods ───────────────────────────────────────────────────────────

export interface PostListFilters {
  status?: 'draft' | 'published' | 'scheduled';
  tag?: string;
  sort?: 'manual' | 'recent';
  page?: string | number;
  perPage?: string | number;
}

/**
 * List posts (admin: all statuses; public: only published+non-deleted).
 * Results are cached for public reads.
 */
export async function listPosts(filters: PostListFilters, adminMode = false) {
  if (adminMode) {
    const result = await findManyPosts(filters, true);
    return { ...result, data: result.data.map(flattenPivotTags) };
  }

  const sort = filters.sort ?? 'recent';
  const key = `posts:list:page=${filters.page ?? 1}:perPage=${filters.perPage ?? 20}:tag=${filters.tag ?? ''}:sort=${sort}`;
  return cached(key, LIST_TTL, async () => {
    const result = await findManyPosts({ ...filters, sort }, false);
    return { ...result, data: result.data.map(flattenPivotTags) };
  });
}

/**
 * Get a single post by slug.
 * Public: includes approved comments, returns pre-rendered HTML.
 * Admin: includes all data, no cache.
 */
export async function getPostBySlug(slug: string, adminMode = false) {
  if (adminMode) {
    const post = await findPostBySlug(slug, true);
    if (!post) return null;
    return flattenPivotTags(post);
  }

  const key = `posts:slug:${slug}`;
  return cached(key, DETAIL_TTL, async () => {
    const post = await findPostBySlug(slug, false);
    if (!post) return null;

    const comments = await findApprovedCommentsByPostId(post.id);
    return { ...flattenPivotTags(post), comments };
  });
}

/**
 * Create a new post.
 * Generates a slug, renders Markdown, syncs tags, and invalidates cache.
 */
export async function createPostService(data: CreatePostInput) {
  // 1. Resolve slug
  const baseSlug = data.slug ?? generateSlug(data.title);
  const slug = await ensureUniqueSlug(baseSlug, (s) => postSlugTaken(s));

  // 2. Render Markdown content
  const renderedContent = await renderMarkdown(data.content);

  // 3. Resolve timestamps based on status
  const status = data.status ?? 'draft';
  const publishedAt = status === 'published' ? new Date() : undefined;
  // scheduledAt is a Date from Zod transform when status = 'scheduled'
  const scheduledAt = status === 'scheduled' ? (data.scheduledAt as Date | undefined) : undefined;
  const normalizedTagIds = data.tagIds ? normalizeTagIds(data.tagIds) : [];

  // 3a. Validate tag references before the transaction to surface a
  // deterministic domain error instead of a foreign-key 500.
  await assertTagsExist(normalizedTagIds);

  // 4. Persist atomically: create post + tag sync + outbox event in one transaction.
  // Keeping tag sync inside the same transaction guarantees that a crash between
  // post insert and tag sync never leaves the post in a tag-less state.
  // If the process crashes after the INSERT but before BullMQ, the relay will still
  // pick up the outbox event and enqueue the delayed publish job on the next poll.
  const post = await db.transaction(async (tx) => {
    // 5. Insert post via repo — passes tx so the operation joins the transaction
    const row = await createPost(
      {
        slug,
        title: data.title,
        content: data.content,
        renderedContent,
        excerpt: data.excerpt,
        coverUrl: data.coverUrl,
        status,
        order: data.order ?? 0,
        publishedAt,
        scheduledAt,
      },
      tx
    );

    if (!row) throw new Error('Failed to create post — database returned no row');

    // Sync tags atomically with the post insert
    if (normalizedTagIds.length > 0) {
      await syncPostTagsInTx(tx, row.id, normalizedTagIds);
    }

    if (status === 'scheduled' && scheduledAt) {
      await tx.insert(outbox).values({
        eventType: OutboxEventType.SCHEDULED_POST_PUBLISH,
        payload: { postId: row.id, scheduledAt: scheduledAt.toISOString() },
      });
    }

    return row;
  });

  // 6. Invalidate cache
  await invalidateGroup('postsContent');

  return post;
}

/**
 * Update an existing post by ID.
 * Re-renders Markdown if content changed, handles slug uniqueness,
 * sets publishedAt on first publish, syncs tags, manages scheduling job,
 * and invalidates cache.
 */
export async function updatePostService(id: number, data: UpdatePostInput) {
  // 1. Fetch current post (admin mode — includes drafts/deleted)
  const current = await db
    .select()
    .from(posts)
    .where(and(eq(posts.id, id)))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!current) return null;

  const patch: Partial<typeof posts.$inferInsert> = {};

  // 2. Slug update — must stay unique (excluding self)
  if (data.slug !== undefined && data.slug !== current.slug) {
    const taken = await postSlugTaken(data.slug, id);
    if (taken) {
      throw new ConflictError(`Slug "${data.slug}" is already taken`);
    }
    patch.slug = data.slug;
  }

  // 3. Title update — auto-regenerate slug only if no explicit slug provided and title changed
  if (data.title !== undefined) {
    patch.title = data.title;
  }

  // 4. Content update — re-render Markdown
  if (data.content !== undefined) {
    patch.content = data.content;
    patch.renderedContent = await renderMarkdown(data.content);
  }

  // 5. Optional fields
  if (data.excerpt !== undefined) patch.excerpt = data.excerpt;
  if (data.coverUrl !== undefined) patch.coverUrl = data.coverUrl;
  if (data.status !== undefined) patch.status = data.status;
  if (data.order !== undefined) patch.order = data.order;

  // 6. Resolve timestamps based on status transitions
  const newStatus = data.status ?? current.status;

  if (newStatus === 'published') {
    // Set publishedAt only on first publish transition
    if (!current.publishedAt) {
      patch.publishedAt = new Date();
    }
    // Clear scheduledAt — post is now live
    patch.scheduledAt = null;
  } else if (newStatus === 'scheduled') {
    // scheduledAt is a Date from Zod transform
    const scheduledAt = data.scheduledAt as Date | undefined;
    if (scheduledAt) {
      patch.scheduledAt = scheduledAt;
    }
    // Ensure publishedAt remains null for scheduled posts
    patch.publishedAt = null;
  } else if (newStatus === 'draft') {
    // Revert to draft — clear both timestamps
    patch.scheduledAt = null;
  }

  // 7. Persist atomically: update post + optional outbox event for new scheduling.
  // Scheduled publish creation/reschedule is intentionally materialized only by the
  // worker outbox relay so the DB write and async intent stay in the same transaction.
  // Cancellation of existing BullMQ jobs (transitioning away from scheduled) is
  // direct and idempotent — no outbox needed for removals.

  // Validate tag references before the transaction to surface a deterministic
  // domain error instead of a foreign-key 500.
  const normalizedTagIds = data.tagIds !== undefined ? normalizeTagIds(data.tagIds) : undefined;
  if (normalizedTagIds !== undefined) {
    await assertTagsExist(normalizedTagIds);
  }

  const updated = await db.transaction(async (tx) => {
    // 7. Update post via repo — passes tx so the operation joins the transaction
    const row = await updatePost(id, patch, tx);

    if (!row) return null;

    // Sync tags atomically with the post update — tag failure rolls back the update
    if (normalizedTagIds !== undefined) {
      await syncPostTagsInTx(tx, id, normalizedTagIds);
    }

    if (newStatus === 'scheduled' && patch.scheduledAt) {
      await tx.insert(outbox).values({
        eventType: OutboxEventType.SCHEDULED_POST_PUBLISH,
        payload: { postId: id, scheduledAt: (patch.scheduledAt as Date).toISOString() },
      });
    }

    return row;
  });
  if (!updated) return null;

  // 9. Cancel BullMQ job when transitioning away from scheduled status
  if ((newStatus === 'published' || newStatus === 'draft') && current.status === 'scheduled') {
    await cancelScheduledPostPublish(id);
  }

  // 10. Invalidate cache
  await invalidateGroup('postsContent');

  return updated;
}

/**
 * Soft-delete a post by ID.
 * Sets deleted_at, cancels any pending publish job, and purges related cache entries.
 */
export async function softDeletePostService(id: number) {
  // Fetch current post to check if it was scheduled
  const current = await db
    .select({ id: posts.id, status: posts.status })
    .from(posts)
    .where(eq(posts.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  const result = await softDeletePost(id);
  if (!result) return null;

  // Cancel any scheduled publish job for this post
  if (current?.status === 'scheduled') {
    await cancelScheduledPostPublish(id);
  }

  await invalidateGroup('postsContent');
  return result;
}
