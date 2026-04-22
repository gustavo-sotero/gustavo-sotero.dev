/**
 * Client-side resume data fetcher.
 * This file intentionally does NOT import 'server-only' so it can be used
 * inside client components (e.g. HeroResumeDownloadButtonInner).
 */
import type { Education, Experience, Project, Tag } from '@portfolio/shared';
import { apiGet, apiGetPaginated } from '@/lib/api';

export interface ResumeDataPayload {
  experience: Experience[];
  education: Education[];
  tags: Tag[];
  projects: Project[];
}

/** Fetches all resume data from the public API. For use in client components only. */
export async function getResumeDataClient(): Promise<ResumeDataPayload> {
  const [expRes, eduRes, tagsRes, projRes] = await Promise.all([
    apiGetPaginated<Experience>('/experience?status=published&perPage=20').catch(() => ({
      data: [] as Experience[],
    })),
    apiGetPaginated<Education>('/education?status=published&perPage=20').catch(() => ({
      data: [] as Education[],
    })),
    apiGet<Tag[]>('/tags?source=project').catch(() => undefined),
    apiGetPaginated<Project>('/projects?status=published&featured=true&perPage=20').catch(() => ({
      data: [] as Project[],
    })),
  ]);

  return {
    experience: expRes.data ?? [],
    education: eduRes.data ?? [],
    tags: Array.isArray(tagsRes?.data) ? (tagsRes.data as Tag[]) : [],
    projects: projRes.data ?? [],
  };
}
