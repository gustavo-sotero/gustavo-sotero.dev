/**
 * Resume aggregate service.
 *
 * Returns everything the resume page and PDF route need in a single
 * cached round-trip: static profile data plus all four dynamic sections
 * (experience, education, skills, projects).
 *
 * COUNT queries are skipped on every section via `{ includeTotal: false }`
 * because the resume renders unbounded lists — no pagination totals required.
 */

import { DEVELOPER_PUBLIC_PROFILE } from '@portfolio/shared/constants/developerProfile';
import type { Education } from '@portfolio/shared/types/education';
import type { Experience } from '@portfolio/shared/types/experience';
import type { Project } from '@portfolio/shared/types/projects';
import type { ResumeAggregateDTO } from '@portfolio/shared/types/resume';
import { cached } from '../lib/cache';
import { listEducation } from './education.service';
import { listExperience } from './experience.service';
import { listProjects } from './projects.service';
import { listSkills } from './skills.service';

const RESUME_TTL = 300; // 5 minutes

async function fetchResumeAggregate(): Promise<ResumeAggregateDTO> {
  const [experienceResult, educationResult, skillsResult, projectsResult] = await Promise.all([
    listExperience({ status: 'published', page: 1, perPage: 100 }, false, { includeTotal: false }),
    listEducation({ status: 'published', page: 1, perPage: 100 }, false, { includeTotal: false }),
    listSkills({ page: 1, perPage: 100 }, true, { includeTotal: false }),
    listProjects({ page: 1, perPage: 100, featuredFirst: true, status: 'published' }, false, {
      includeTotal: false,
    }),
  ]);

  // DB rows carry Date objects for timestamp columns; JSON serialisation at the
  // API boundary converts them to ISO strings, which satisfies the DTO shape.
  return {
    profile: DEVELOPER_PUBLIC_PROFILE,
    experience: experienceResult.data as unknown as Experience[],
    education: educationResult.data as unknown as Education[],
    skills: skillsResult.data,
    projects: projectsResult.data as unknown as Project[],
  };
}

/**
 * Returns the full resume aggregate payload, Redis-cached for RESUME_TTL seconds.
 */
export async function getResumeAggregate(): Promise<ResumeAggregateDTO> {
  return cached('resume:aggregate', RESUME_TTL, fetchResumeAggregate);
}
