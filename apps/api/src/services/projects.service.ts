/**
 * Service layer for projects.
 *
 * Mirrors PostService structure with project-specific fields:
 * `repositoryUrl`, `liveUrl`, `featured`, `order`.
 * Projects do not have a `publishedAt` field.
 */

import { projects } from '@portfolio/shared/db/schema';
import type { CreateProjectInput, UpdateProjectInput } from '@portfolio/shared/schemas/projects';
import { eq } from 'drizzle-orm';
import { db } from '../config/db';
import { cached, invalidateGroup } from '../lib/cache';
import { renderMarkdown } from '../lib/markdown';
import { flattenPivotTags, resolveSlugTaken } from '../lib/pivotHelpers';
import { ensureUniqueSlug, generateSlug } from '../lib/slug';
import { assertTagsExist, normalizeTagIds } from '../lib/tagValidation';
import {
  createProject,
  findManyProjects,
  findProjectBySlug,
  softDeleteProject,
  updateProject,
} from '../repositories/projects.repo';
import { syncProjectTagsInTx } from '../repositories/tags.repo';

// ── Cache TTLs ────────────────────────────────────────────────────────────────

const LIST_TTL = 300; // 5 minutes
const DETAIL_TTL = 3600; // 1 hour

// ── Slug uniqueness check ─────────────────────────────────────────────────────

async function projectSlugTaken(slug: string, excludeId?: number): Promise<boolean> {
  const rows = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.slug, slug))
    .limit(1);
  return resolveSlugTaken(rows, excludeId);
}

// ── Service methods ───────────────────────────────────────────────────────────

export interface ProjectListFilters {
  status?: 'draft' | 'published';
  tag?: string;
  featured?: boolean;
  featuredFirst?: boolean;
  page?: string | number;
  perPage?: string | number;
}

/**
 * List projects (admin: all statuses; public: only published+non-deleted).
 * Results are cached for public reads.
 */
export async function listProjects(filters: ProjectListFilters, adminMode = false) {
  if (adminMode) {
    const result = await findManyProjects(filters, true);
    return { ...result, data: result.data.map(flattenPivotTags) };
  }

  const key = `projects:list:page=${filters.page ?? 1}:perPage=${filters.perPage ?? 20}:tag=${filters.tag ?? ''}:featured=${String(filters.featured ?? false)}:featuredFirst=${String(filters.featuredFirst ?? false)}`;
  return cached(key, LIST_TTL, async () => {
    const result = await findManyProjects(filters, false);
    return { ...result, data: result.data.map(flattenPivotTags) };
  });
}

/**
 * Get a single project by slug.
 * Public: includes tags, returns pre-rendered HTML. Admin: no cache.
 */
export async function getProjectBySlug(slug: string, adminMode = false) {
  if (adminMode) {
    const project = await findProjectBySlug(slug, true);
    if (!project) return null;
    return flattenPivotTags(project);
  }

  const key = `projects:slug:${slug}`;
  return cached(key, DETAIL_TTL, async () => {
    const project = await findProjectBySlug(slug, false);
    if (!project) return null;
    return flattenPivotTags(project);
  });
}

/**
 * Create a new project.
 * Generates a slug, renders Markdown (if content provided), syncs tags
 * atomically with the insert, and invalidates cache.
 */
export async function createProjectService(data: CreateProjectInput) {
  // 1. Resolve slug
  const baseSlug = data.slug ?? generateSlug(data.title);
  const slug = await ensureUniqueSlug(baseSlug, (s) => projectSlugTaken(s));

  // 2. Render Markdown content if provided
  const renderedContent = data.content ? await renderMarkdown(data.content) : undefined;
  const normalizedTagIds = data.tagIds ? normalizeTagIds(data.tagIds) : [];

  // 3. Persist atomically: create project + tag sync in one transaction.
  // Keeping tag sync inside the same transaction guarantees that a crash between
  // project insert and tag sync never leaves the project in a tag-less state.

  // Validate tag references before the transaction to surface a deterministic
  // domain error instead of a foreign-key 500.
  await assertTagsExist(normalizedTagIds);

  const project = await db.transaction(async (tx) => {
    // Insert project via repo — passes tx so the operation joins the transaction
    const row = await createProject(
      {
        slug,
        title: data.title,
        description: data.description,
        content: data.content,
        renderedContent,
        coverUrl: data.coverUrl,
        status: data.status ?? 'draft',
        repositoryUrl: data.repositoryUrl,
        liveUrl: data.liveUrl,
        featured: data.featured ?? false,
        order: data.order ?? 0,
        impactFacts: data.impactFacts ?? [],
      },
      tx
    );

    if (!row) throw new Error('Failed to create project — database returned no row');

    // Sync tags atomically with the project insert
    if (normalizedTagIds.length > 0) {
      await syncProjectTagsInTx(tx, row.id, normalizedTagIds);
    }

    return row;
  });

  // 5. Invalidate cache
  await invalidateGroup('projectsContent');

  return project;
}

/**
 * Update an existing project by ID.
 * Re-renders Markdown if content changed, handles slug uniqueness,
 * syncs tags, invalidates cache.
 */
export async function updateProjectService(id: number, data: UpdateProjectInput) {
  // 1. Fetch current project
  const current = await db
    .select()
    .from(projects)
    .where(eq(projects.id, id))
    .limit(1)
    .then((rows) => rows[0] ?? null);

  if (!current) return null;

  const patch: Partial<typeof projects.$inferInsert> = {};

  // 2. Slug update — must stay unique (excluding self)
  if (data.slug !== undefined && data.slug !== current.slug) {
    const taken = await projectSlugTaken(data.slug, id);
    if (taken) {
      throw new Error(`CONFLICT: Slug "${data.slug}" is already taken`);
    }
    patch.slug = data.slug;
  }

  // 3. Simple field updates
  if (data.title !== undefined) patch.title = data.title;
  if (data.description !== undefined) patch.description = data.description;
  if (data.coverUrl !== undefined) patch.coverUrl = data.coverUrl;
  if (data.status !== undefined) patch.status = data.status;
  if (data.repositoryUrl !== undefined) patch.repositoryUrl = data.repositoryUrl;
  if (data.liveUrl !== undefined) patch.liveUrl = data.liveUrl;
  if (data.featured !== undefined) patch.featured = data.featured;
  if (data.order !== undefined) patch.order = data.order;
  if (data.impactFacts !== undefined) patch.impactFacts = data.impactFacts;

  // 4. Content update — re-render Markdown
  if (data.content !== undefined) {
    patch.content = data.content;
    patch.renderedContent = await renderMarkdown(data.content);
  }

  // 5. Persist atomically: update project + tag sync in one transaction

  // Validate tag references before the transaction.
  const normalizedTagIds = data.tagIds !== undefined ? normalizeTagIds(data.tagIds) : undefined;
  if (normalizedTagIds !== undefined) {
    await assertTagsExist(normalizedTagIds);
  }

  const updated = await db.transaction(async (tx) => {
    // Update project via repo — passes tx so the operation joins the transaction
    const row = await updateProject(id, patch, tx);

    if (!row) return null;

    // Sync tags atomically with the project update — tag failure rolls back the update
    if (normalizedTagIds !== undefined) {
      await syncProjectTagsInTx(tx, id, normalizedTagIds);
    }

    return row;
  });
  if (!updated) return null;

  // 6. Invalidate cache
  await invalidateGroup('projectsContent');

  return updated;
}

/**
 * Soft-delete a project by ID.
 * Sets deleted_at and purges related cache entries.
 */
export async function softDeleteProjectService(id: number) {
  const result = await softDeleteProject(id);
  if (!result) return null;

  await invalidateGroup('projectsContent');
  return result;
}
