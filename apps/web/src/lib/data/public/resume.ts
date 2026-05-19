import 'server-only';
import type { ResumeAggregateDTO } from '@portfolio/shared/types/resume';
import { cacheLife, cacheTag } from 'next/cache';
import { apiServerGet } from '@/lib/api.server';
import { logServerError } from '@/lib/server-logger';
import {
  TAG_EDUCATION_LIST,
  TAG_EXPERIENCE_LIST,
  TAG_PROJECTS_LIST,
  TAG_SKILLS_LIST,
} from './cache-tags';

export type ResumeLoaderResult =
  | { state: 'ok'; data: ResumeAggregateDTO }
  | { state: 'degraded'; data: ResumeAggregateDTO };

async function loadResumeData(): Promise<ResumeLoaderResult> {
  const result = await apiServerGet<ResumeAggregateDTO>('/resume').catch((err) => {
    logServerError('data:resume', 'Failed to fetch resume aggregate', {
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  });

  if (!result) {
    return {
      state: 'degraded',
      data: {
        profile: (await import('@portfolio/shared/constants/developerProfile'))
          .DEVELOPER_PUBLIC_PROFILE,
        experience: [],
        education: [],
        skills: [],
        projects: [],
      },
    };
  }

  return { state: 'ok', data: result };
}

/** All data needed to build the resume view-model, fetched as a single aggregate. */
export async function getResumeData(): Promise<ResumeLoaderResult> {
  'use cache';
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(TAG_EXPERIENCE_LIST, TAG_EDUCATION_LIST, TAG_PROJECTS_LIST, TAG_SKILLS_LIST);

  return loadResumeData();
}

/** Download routes should bypass cache so the generated PDF always reflects the latest resume. */
export async function getResumeDataUncached(): Promise<ResumeLoaderResult> {
  return loadResumeData();
}
