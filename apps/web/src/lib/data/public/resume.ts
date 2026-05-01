import 'server-only';
import type { Education } from '@portfolio/shared/types/education';
import type { Experience } from '@portfolio/shared/types/experience';
import type { Project } from '@portfolio/shared/types/projects';
import type { Skill } from '@portfolio/shared/types/skills';
import { cacheLife, cacheTag } from 'next/cache';
import { apiServerGetPaginated } from '@/lib/api.server';
import { logServerError } from '@/lib/server-logger';
import {
  TAG_EDUCATION_LIST,
  TAG_EXPERIENCE_LIST,
  TAG_PROJECTS_LIST,
  TAG_SKILLS_LIST,
} from './cache-tags';

export interface ResumeDataPayload {
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
}

export type ResumeLoaderResult =
  | { state: 'ok'; data: ResumeDataPayload }
  | { state: 'degraded'; data: ResumeDataPayload };

const EMPTY_RESUME_DATA: ResumeDataPayload = {
  experience: [],
  education: [],
  skills: [],
  projects: [],
};

/** All data needed to build the resume view-model, fetched in parallel. */
export async function getResumeData(): Promise<ResumeLoaderResult> {
  'use cache';
  cacheLife({ stale: 300, revalidate: 300, expire: 3600 });
  cacheTag(TAG_EXPERIENCE_LIST, TAG_EDUCATION_LIST, TAG_PROJECTS_LIST, TAG_SKILLS_LIST);

  let degraded = false;

  const [experienceRes, educationRes, skillsRes, projectsRes] = await Promise.all([
    apiServerGetPaginated<Experience>('/experience?status=published&perPage=20').catch((err) => {
      degraded = true;
      logServerError('data:resume', 'Failed to fetch experience', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { data: [] as Experience[] };
    }),
    apiServerGetPaginated<Education>('/education?status=published&perPage=20').catch((err) => {
      degraded = true;
      logServerError('data:resume', 'Failed to fetch education', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { data: [] as Education[] };
    }),
    apiServerGetPaginated<Skill>('/skills?perPage=100').catch((err) => {
      degraded = true;
      logServerError('data:resume', 'Failed to fetch skills', {
        error: err instanceof Error ? err.message : String(err),
      });
      return { data: [] as Skill[] };
    }),
    apiServerGetPaginated<Project>('/projects?status=published&featured=true&perPage=20').catch(
      (err) => {
        degraded = true;
        logServerError('data:resume', 'Failed to fetch projects', {
          error: err instanceof Error ? err.message : String(err),
        });
        return { data: [] as Project[] };
      }
    ),
  ]);

  const data: ResumeDataPayload = {
    experience: experienceRes.data,
    education: educationRes.data,
    skills: Array.isArray(skillsRes.data) ? skillsRes.data : [],
    projects: projectsRes.data,
  };

  if (degraded) {
    return { state: 'degraded', data: { ...EMPTY_RESUME_DATA, ...data } };
  }

  return { state: 'ok', data };
}
