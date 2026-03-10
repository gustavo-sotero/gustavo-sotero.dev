/**
 * Developer Profile aggregation service.
 *
 * Composes a complete public snapshot of the developer's profile by
 * fetching data from existing repositories in parallel and assembling a
 * deterministic, safe DTO.
 *
 * All data returned here follows the same public-only filters already
 * enforced by each repository (published + non-deleted). No admin data
 * leaks are possible.
 */

import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared';
import { cached } from '../lib/cache';
import { flattenPivotTagArray } from '../lib/pivotHelpers';
import { getPageviewCount } from '../repositories/analytics.repo';
import { findManyEducation } from '../repositories/education.repo';
import { findManyExperience } from '../repositories/experience.repo';
import { findManyPosts } from '../repositories/posts.repo';
import { findManyProjects } from '../repositories/projects.repo';
import { findManyTags } from '../repositories/tags.repo';

// ── Static Profile Data ───────────────────────────────────────────────────────

/**
 * The canonical representation of the developer's identity.
 * This is intentionally static — it changes only when the developer updates
 * it. Keep PII out: no private email, phone, or address here.
 */
const PROFILE_DATA = DEVELOPER_PUBLIC_PROFILE;

// ── Constants ─────────────────────────────────────────────────────────────────

/** Number of recent posts/projects to include in the profile payload. */
const RECENT_POSTS_LIMIT = 5;
const RECENT_PROJECTS_LIMIT = 5;

/** Cache TTL in seconds. */
const PROFILE_TTL = 300; // 5 minutes

// ── Types ─────────────────────────────────────────────────────────────────────

export interface TagDTO {
  id: number;
  name: string;
  slug: string;
  category: string;
  iconKey: string | null;
}

export interface StackDTO {
  groups: {
    language: TagDTO[];
    framework: TagDTO[];
    tool: TagDTO[];
    db: TagDTO[];
    cloud: TagDTO[];
    infra: TagDTO[];
    other: TagDTO[];
  };
}

export interface ExperienceItemDTO {
  id: number;
  slug: string;
  company: string;
  role: string;
  description: string;
  location: string | null;
  employmentType: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  order: number;
  logoUrl: string | null;
}

export interface EducationItemDTO {
  id: number;
  slug: string;
  title: string;
  institution: string;
  description: string | null;
  location: string | null;
  educationType: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  workloadHours: number | null;
  order: number;
  logoUrl: string | null;
}

export interface PostSummaryDTO {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: TagDTO[];
}

export interface ProjectSummaryDTO {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  featured: boolean;
  repositoryUrl: string | null;
  liveUrl: string | null;
  createdAt: string;
  updatedAt: string;
  tags: TagDTO[];
}

export interface MetricsDTO {
  totalPostsPublished: number;
  totalProjectsPublished: number;
  totalTagsInUse: number;
  pageviews30d: number;
  lastCalculatedAt: string;
}

export interface DeveloperProfileDTO {
  profile: typeof PROFILE_DATA;
  stack: StackDTO;
  experience: ExperienceItemDTO[];
  education: EducationItemDTO[];
  projects: ProjectSummaryDTO[];
  posts: PostSummaryDTO[];
  metrics: MetricsDTO;
  updatedAt: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Normalize a date value to an ISO string. */
function toIso(value: Date | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString();
}

function toIsoRequired(value: Date | string): string {
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toISOString();
}

/** Map a raw tag row to a public DTO. */
function mapTag(raw: {
  id: number;
  name: string;
  slug: string;
  category: string;
  iconKey: string | null;
}): TagDTO {
  return {
    id: raw.id,
    name: raw.name,
    slug: raw.slug,
    category: raw.category,
    iconKey: raw.iconKey,
  };
}

/** Build the stack groups from a flat list of tags. */
function buildStack(
  tags: Array<{ id: number; name: string; slug: string; category: string; iconKey: string | null }>
): StackDTO {
  const empty = (): TagDTO[] => [];

  const groups: StackDTO['groups'] = {
    language: empty(),
    framework: empty(),
    tool: empty(),
    db: empty(),
    cloud: empty(),
    infra: empty(),
    other: empty(),
  };

  for (const tag of tags) {
    const dto = mapTag(tag);
    const cat = tag.category as keyof StackDTO['groups'];
    if (cat in groups) {
      groups[cat].push(dto);
    } else {
      groups.other.push(dto);
    }
  }

  return { groups };
}

// ── Aggregation ───────────────────────────────────────────────────────────────

/**
 * Fetch and compose the complete developer profile payload.
 * All queries run in parallel for minimal latency.
 */
async function fetchDeveloperProfile(): Promise<DeveloperProfileDTO> {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const now = new Date();

  const [postsResult, projectsResult, tagsResult, experienceResult, educationResult, pageviews] =
    await Promise.all([
      findManyPosts({ page: 1, perPage: RECENT_POSTS_LIMIT }, false),
      findManyProjects({ page: 1, perPage: RECENT_PROJECTS_LIMIT, featuredFirst: true }, false),
      findManyTags({}, true),
      findManyExperience({ page: 1, perPage: 100 }, false),
      findManyEducation({ page: 1, perPage: 100 }, false),
      getPageviewCount({ from: thirtyDaysAgo, to: now }),
    ]);

  // ── Stack ──────────────────────────────────────────────────────────────────
  const stack = buildStack(tagsResult.data);

  // ── Experience ─────────────────────────────────────────────────────────────
  const experience: ExperienceItemDTO[] = experienceResult.data.map((e) => ({
    id: e.id,
    slug: e.slug,
    company: e.company,
    role: e.role,
    description: e.description,
    location: e.location ?? null,
    employmentType: e.employmentType ?? null,
    startDate: toIsoRequired(e.startDate),
    endDate: toIso(e.endDate),
    isCurrent: e.isCurrent ?? false,
    order: e.order ?? 0,
    logoUrl: e.logoUrl ?? null,
  }));

  // ── Education ──────────────────────────────────────────────────────────────
  const educationList: EducationItemDTO[] = educationResult.data.map((ed) => ({
    id: ed.id,
    slug: ed.slug,
    title: ed.title,
    institution: ed.institution,
    description: ed.description ?? null,
    location: ed.location ?? null,
    educationType: ed.educationType ?? null,
    startDate: toIso(ed.startDate),
    endDate: toIso(ed.endDate),
    isCurrent: ed.isCurrent ?? false,
    workloadHours: ed.workloadHours ?? null,
    order: ed.order ?? 0,
    logoUrl: ed.logoUrl ?? null,
  }));

  // ── Posts ──────────────────────────────────────────────────────────────────
  const posts: PostSummaryDTO[] = postsResult.data.map((p) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    excerpt: p.excerpt ?? null,
    coverUrl: p.coverUrl ?? null,
    publishedAt: toIso(p.publishedAt),
    createdAt: toIsoRequired(p.createdAt),
    updatedAt: toIsoRequired(p.updatedAt),
    tags: flattenPivotTagArray((p.tags ?? []) as Array<{ tag: Parameters<typeof mapTag>[0] }>).map(
      mapTag
    ),
  }));

  // ── Projects ───────────────────────────────────────────────────────────────
  const projects: ProjectSummaryDTO[] = projectsResult.data.map((pr) => ({
    id: pr.id,
    slug: pr.slug,
    title: pr.title,
    description: pr.description ?? null,
    coverUrl: pr.coverUrl ?? null,
    featured: pr.featured ?? false,
    repositoryUrl: pr.repositoryUrl ?? null,
    liveUrl: pr.liveUrl ?? null,
    createdAt: toIsoRequired(pr.createdAt),
    updatedAt: toIsoRequired(pr.updatedAt),
    tags: flattenPivotTagArray((pr.tags ?? []) as Array<{ tag: Parameters<typeof mapTag>[0] }>).map(
      mapTag
    ),
  }));

  // ── Metrics ────────────────────────────────────────────────────────────────
  const metrics: MetricsDTO = {
    totalPostsPublished: postsResult.meta.total,
    totalProjectsPublished: projectsResult.meta.total,
    totalTagsInUse: tagsResult.meta.total,
    pageviews30d: pageviews,
    lastCalculatedAt: now.toISOString(),
  };

  return {
    profile: PROFILE_DATA,
    stack,
    experience,
    education: educationList,
    projects,
    posts,
    metrics,
    updatedAt: now.toISOString(),
  };
}

// ── Public Service API ────────────────────────────────────────────────────────

/**
 * Returns the developer profile payload, with Redis-backed caching.
 *
 * The TTL is intentionally short (5 min) so updates to posts/projects/tags
 * are reflected quickly without requiring manual cache invalidation.
 */
export async function getDeveloperProfile(): Promise<DeveloperProfileDTO> {
  return cached('developer:profile', PROFILE_TTL, fetchDeveloperProfile);
}
