/**
 * Client-side resume data fetcher.
 * This file intentionally does NOT import 'server-only' so it can be used
 * inside client components (e.g. HeroResumeDownloadButtonInner).
 */
import type { Education, Experience, Project, Skill } from '@portfolio/shared';
import { apiGetPaginated } from '@/lib/api';

export interface ResumeDataPayload {
  experience: Experience[];
  education: Education[];
  skills: Skill[];
  projects: Project[];
}

/** Fetches all resume data from the public API. For use in client components only. */
export async function getResumeDataClient(): Promise<ResumeDataPayload> {
  const [expRes, eduRes, skillsRes, projRes] = await Promise.all([
    apiGetPaginated<Experience>('/experience?status=published&perPage=20').catch(() => ({
      data: [] as Experience[],
    })),
    apiGetPaginated<Education>('/education?status=published&perPage=20').catch(() => ({
      data: [] as Education[],
    })),
    apiGetPaginated<Skill>('/skills?perPage=100').catch(() => ({
      data: [] as Skill[],
    })),
    apiGetPaginated<Project>('/projects?status=published&featured=true&perPage=20').catch(() => ({
      data: [] as Project[],
    })),
  ]);

  return {
    experience: expRes.data ?? [],
    education: eduRes.data ?? [],
    skills: Array.isArray(skillsRes?.data) ? (skillsRes.data as Skill[]) : [],
    projects: projRes.data ?? [],
  };
}
