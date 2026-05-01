/**
 * Home aggregate endpoint.
 *
 * Returns all sections needed by the public home page in a single round-trip,
 * eliminating the N=7 separate API calls previously made by the web SSR layer.
 * No pagination `meta` is included — the home page renders fixed-size sets and
 * does not need total counts, so there are no COUNT queries.
 *
 * Routes:
 *  GET /home   - All home sections combined (posts, projects, skills, blogTags,
 *                experience, education)
 */

import { Hono } from 'hono';
import { successResponse } from '../../lib/response';
import { listEducation } from '../../services/education.service';
import { listExperience } from '../../services/experience.service';
import { listPosts } from '../../services/posts.service';
import { listProjects } from '../../services/projects.service';
import { listSkills } from '../../services/skills.service';
import { listTags } from '../../services/tags.service';
import type { AppEnv } from '../../types/index';

const publicHomeRouter = new Hono<AppEnv>();

/**
 * GET /home
 *
 * Returns all home-page sections in one response.
 * Results are cached at the service layer (each service owns its own cache TTL).
 * No pagination meta is returned — the home page does not paginate.
 */
publicHomeRouter.get('/', async (c) => {
  const [postsResult, projectsResult, skillsResult, tagsResult, experienceResult, educationResult] =
    await Promise.all([
      listPosts({ page: 1, perPage: 3, sort: 'manual' }, false, { includeTotal: false }),
      listProjects({ page: 1, perPage: 3, featuredFirst: true }, false, { includeTotal: false }),
      listSkills({ page: 1, perPage: 100 }, true, { includeTotal: false }),
      listTags({ source: 'post' }, true, { includeTotal: false }),
      listExperience({ status: 'published', page: 1, perPage: 10 }, false, { includeTotal: false }),
      listEducation({ status: 'published', page: 1, perPage: 10 }, false, { includeTotal: false }),
    ]);

  return successResponse(c, {
    posts: postsResult.data,
    projects: projectsResult.data,
    skills: skillsResult.data,
    blogTags: tagsResult.data,
    experience: experienceResult.data,
    education: educationResult.data,
  });
});

export { publicHomeRouter };
