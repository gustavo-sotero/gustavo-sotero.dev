'use client';

/**
 * Centralised TanStack Query key factory for all admin domains.
 *
 * All domain hook files import from here so invalidation patterns
 * are consistent and there is a single source of truth.
 */
export const adminKeys = {
  posts: (params?: object) => ['admin', 'posts', params ?? {}] as const,
  post: (slug: string) => ['admin', 'post', slug] as const,

  projects: (params?: object) => ['admin', 'projects', params ?? {}] as const,
  project: (slug: string) => ['admin', 'project', slug] as const,

  tags: (params?: object) => ['admin', 'tags', params ?? {}] as const,

  comments: (params?: object) => ['admin', 'comments', params ?? {}] as const,

  uploads: () => ['admin', 'uploads'] as const,

  contacts: (params?: object) => ['admin', 'contacts', params ?? {}] as const,

  analyticsSummary: (params?: object) => ['admin', 'analytics', 'summary', params ?? {}] as const,
  analyticsTopPosts: (params?: object) =>
    ['admin', 'analytics', 'top-posts', params ?? {}] as const,

  dlq: () => ['admin', 'jobs', 'dlq'] as const,

  experience: (params?: object) => ['admin', 'experience', params ?? {}] as const,
  experienceItem: (slug: string) => ['admin', 'experience-item', slug] as const,

  education: (params?: object) => ['admin', 'education', params ?? {}] as const,
  educationItem: (slug: string) => ['admin', 'education-item', slug] as const,

  aiPostGenerationConfig: () => ['admin', 'ai-post-generation', 'config'] as const,
  aiPostGenerationModels: (params?: object) =>
    ['admin', 'ai-post-generation', 'models', params ?? {}] as const,
} as const;
