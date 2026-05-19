import { join } from 'node:path';
import {
  education,
  experience,
  experienceSkills,
  posts,
  postTags,
  projectSkills,
  projects,
  skills,
  tags,
} from '@portfolio/shared/db/schema';
import { buildPortableWebpVariants } from '@portfolio/shared/lib/image-variants';
import { eq, inArray } from 'drizzle-orm';
import { db, pgClient } from '../config/db';
import { getLogger } from '../config/logger';
import { getPublicUrl, s3 } from '../config/s3';
import { renderMarkdown } from '../lib/markdown';
import { SEED_POSTS } from './seed-data/posts';
import { SEED_EDUCATION, SEED_EXPERIENCE } from './seed-data/profile';
import { SEED_PROJECTS } from './seed-data/projects';
import { SEED_SKILLS, SEED_TAGS } from './seed-data/taxonomy';

const logger = getLogger('db', 'seed');

const LEGACY_PLACEHOLDER_POST_SLUGS = [
  'building-fullstack-portfolio',
  'drizzle-orm-guide',
  'bullmq-background-jobs',
];

const LEGACY_PLACEHOLDER_PROJECT_SLUGS = ['open-source-contributions'];

const LEGACY_PLACEHOLDER_EXPERIENCE_SLUGS = [
  'backend-engineer-saas-platform',
  'fullstack-developer-independent-products',
];

function buildIdMap(rows: Array<{ id: number; slug: string }>) {
  return Object.fromEntries(rows.map((row) => [row.slug, row.id]));
}

function resolveRelationIds(
  slugs: string[],
  idBySlug: Record<string, number>,
  relationName: string,
  ownerSlug: string
) {
  const missingSlugs = slugs.filter((slug) => idBySlug[slug] === undefined);

  if (missingSlugs.length > 0) {
    logger.warn(`Missing ${relationName} for ${ownerSlug}: ${missingSlugs.join(', ')}`);
  }

  return slugs.map((slug) => idBySlug[slug]).filter((id): id is number => id !== undefined);
}

async function archiveLegacyPlaceholders() {
  const now = new Date();
  const activePostSlugs = new Set(SEED_POSTS.map((seedPost) => seedPost.slug));
  const postSlugsToArchive = LEGACY_PLACEHOLDER_POST_SLUGS.filter(
    (slug) => !activePostSlugs.has(slug)
  );

  if (postSlugsToArchive.length > 0) {
    const archivedPosts = await db
      .update(posts)
      .set({ status: 'draft', deletedAt: now, updatedAt: now })
      .where(inArray(posts.slug, postSlugsToArchive))
      .returning({ id: posts.id });

    if (archivedPosts.length > 0) {
      logger.info(`Archived ${archivedPosts.length} legacy post(s)`);
    }
  }

  const activeProjectSlugs = new Set(SEED_PROJECTS.map((seedProject) => seedProject.slug));
  const projectSlugsToArchive = LEGACY_PLACEHOLDER_PROJECT_SLUGS.filter(
    (slug) => !activeProjectSlugs.has(slug)
  );

  if (projectSlugsToArchive.length > 0) {
    const archivedProjects = await db
      .update(projects)
      .set({ status: 'draft', deletedAt: now, updatedAt: now })
      .where(inArray(projects.slug, projectSlugsToArchive))
      .returning({ id: projects.id });

    if (archivedProjects.length > 0) {
      logger.info(`Archived ${archivedProjects.length} legacy project(s)`);
    }
  }

  const activeExperienceSlugs = new Set(
    SEED_EXPERIENCE.map((seedExperience) => seedExperience.slug)
  );
  const experienceSlugsToArchive = LEGACY_PLACEHOLDER_EXPERIENCE_SLUGS.filter(
    (slug) => !activeExperienceSlugs.has(slug)
  );

  if (experienceSlugsToArchive.length > 0) {
    const archivedExperience = await db
      .update(experience)
      .set({ status: 'draft', deletedAt: now, updatedAt: now })
      .where(inArray(experience.slug, experienceSlugsToArchive))
      .returning({ id: experience.id });

    if (archivedExperience.length > 0) {
      logger.info(`Archived ${archivedExperience.length} legacy experience item(s)`);
    }
  }
}

async function seedTags() {
  logger.info('Seeding tags...');
  const insertedTags = await db
    .insert(tags)
    .values(SEED_TAGS)
    .onConflictDoNothing({ target: tags.slug })
    .returning({ id: tags.id, slug: tags.slug });

  for (const seedTag of SEED_TAGS) {
    await db
      .update(tags)
      .set({
        name: seedTag.name,
        category: seedTag.category,
        iconKey: seedTag.iconKey,
        isHighlighted: seedTag.isHighlighted,
      })
      .where(eq(tags.slug, seedTag.slug));
  }

  const allTags = await db.select({ id: tags.id, slug: tags.slug }).from(tags);
  logger.info(`Tags ready: ${allTags.length} total, ${insertedTags.length} newly inserted`);
  return buildIdMap(allTags);
}

async function seedSkills() {
  logger.info('Seeding skills...');
  const insertedSkills = await db
    .insert(skills)
    .values(SEED_SKILLS)
    .onConflictDoNothing({ target: skills.slug })
    .returning({ id: skills.id, slug: skills.slug });

  for (const seedSkill of SEED_SKILLS) {
    await db
      .update(skills)
      .set({
        name: seedSkill.name,
        category: seedSkill.category,
        iconKey: seedSkill.iconKey,
        expertiseLevel: seedSkill.expertiseLevel,
        isHighlighted: seedSkill.isHighlighted,
      })
      .where(eq(skills.slug, seedSkill.slug));
  }

  const allSkills = await db.select({ id: skills.id, slug: skills.slug }).from(skills);
  logger.info(`Skills ready: ${allSkills.length} total, ${insertedSkills.length} newly inserted`);
  return buildIdMap(allSkills);
}

async function seedPosts(tagIdBySlug: Record<string, number>) {
  logger.info('Seeding posts...');

  for (const seedPost of SEED_POSTS) {
    const { tagSlugs, ...postData } = seedPost;
    const renderedContent = await renderMarkdown(postData.content);
    const values = { ...postData, renderedContent, deletedAt: null };

    const [inserted] = await db
      .insert(posts)
      .values(values)
      .onConflictDoNothing({ target: posts.slug })
      .returning({ id: posts.id, slug: posts.slug });

    const [postRecord] = inserted
      ? [inserted]
      : await db
          .update(posts)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(posts.slug, postData.slug))
          .returning({ id: posts.id, slug: posts.slug });

    if (!postRecord) {
      logger.warn(`Post not found after upsert attempt: ${postData.slug}`);
      continue;
    }

    await db.delete(postTags).where(eq(postTags.postId, postRecord.id));

    const tagPivots = resolveRelationIds(tagSlugs, tagIdBySlug, 'tag(s)', postRecord.slug).map(
      (tagId) => ({ postId: postRecord.id, tagId })
    );

    if (tagPivots.length > 0) {
      await db.insert(postTags).values(tagPivots).onConflictDoNothing();
    }

    logger.info(`${inserted ? 'Post inserted' : 'Post updated'}: ${postRecord.slug}`);
  }
}

async function seedProjects(skillIdBySlug: Record<string, number>) {
  logger.info('Seeding projects...');

  for (const seedProject of SEED_PROJECTS) {
    const { skillSlugs, ...projectData } = seedProject;
    const renderedContent = projectData.content ? await renderMarkdown(projectData.content) : null;
    const values = { ...projectData, renderedContent, deletedAt: null };

    const [inserted] = await db
      .insert(projects)
      .values(values)
      .onConflictDoNothing({ target: projects.slug })
      .returning({ id: projects.id, slug: projects.slug });

    const [projectRecord] = inserted
      ? [inserted]
      : await db
          .update(projects)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(projects.slug, projectData.slug))
          .returning({ id: projects.id, slug: projects.slug });

    if (!projectRecord) {
      logger.warn(`Project not found after upsert attempt: ${projectData.slug}`);
      continue;
    }

    await db.delete(projectSkills).where(eq(projectSkills.projectId, projectRecord.id));

    const skillPivots = resolveRelationIds(
      skillSlugs,
      skillIdBySlug,
      'skill(s)',
      projectRecord.slug
    ).map((skillId) => ({ projectId: projectRecord.id, skillId }));

    if (skillPivots.length > 0) {
      await db.insert(projectSkills).values(skillPivots).onConflictDoNothing();
    }

    logger.info(`${inserted ? 'Project inserted' : 'Project updated'}: ${projectRecord.slug}`);
  }
}

async function seedExperience(skillIdBySlug: Record<string, number>) {
  logger.info('Seeding experience...');

  for (const seedExperience of SEED_EXPERIENCE) {
    const { skillSlugs, ...experienceData } = seedExperience;
    const values = { ...experienceData, deletedAt: null };

    const [inserted] = await db
      .insert(experience)
      .values(values)
      .onConflictDoNothing({ target: experience.slug })
      .returning({ id: experience.id, slug: experience.slug });

    const [experienceRecord] = inserted
      ? [inserted]
      : await db
          .update(experience)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(experience.slug, experienceData.slug))
          .returning({ id: experience.id, slug: experience.slug });

    if (!experienceRecord) {
      logger.warn(`Experience not found after upsert attempt: ${experienceData.slug}`);
      continue;
    }

    await db.delete(experienceSkills).where(eq(experienceSkills.experienceId, experienceRecord.id));

    const skillPivots = resolveRelationIds(
      skillSlugs,
      skillIdBySlug,
      'skill(s)',
      experienceRecord.slug
    ).map((skillId) => ({ experienceId: experienceRecord.id, skillId }));

    if (skillPivots.length > 0) {
      await db.insert(experienceSkills).values(skillPivots).onConflictDoNothing();
    }

    logger.info(
      `${inserted ? 'Experience inserted' : 'Experience updated'}: ${experienceRecord.slug}`
    );
  }
}

async function uploadOptimizedCover(filePath: string, key: string): Promise<string> {
  const raw = await Bun.file(filePath).arrayBuffer();
  const { variants } = await buildPortableWebpVariants(raw, [
    { key: 'cover', maxWidth: 1200, maxHeight: 1200, quality: 85 },
  ] as const);

  await s3.file(key).write(variants.cover.bytes, { type: variants.cover.mime });
  return getPublicUrl(key);
}

async function seedCovers(
  items: Array<{ slug: string; coverImage?: string }>,
  subdirectory: 'projects' | 'posts',
  updateFn: (slug: string, coverUrl: string) => Promise<boolean>
) {
  const coversDir = join(import.meta.dirname, 'seed-data', 'covers');
  const withCover = items.filter((item) => item.coverImage);
  if (withCover.length === 0) return;

  logger.info(`Seeding ${subdirectory} covers: ${withCover.length} item(s)`);

  for (const item of withCover) {
    const filename = item.coverImage as string;
    const filePath = join(coversDir, filename);

    if (!(await Bun.file(filePath).exists())) {
      logger.warn(`Cover file not found: ${filename} — skipping ${item.slug}`);
      continue;
    }

    const coverUrl = await uploadOptimizedCover(
      filePath,
      `covers/${subdirectory}/${item.slug}.webp`
    );
    const found = await updateFn(item.slug, coverUrl);
    const entity = subdirectory === 'projects' ? 'project' : 'post';
    if (found) {
      logger.info(`Cover seeded: ${subdirectory}/${item.slug} → ${coverUrl}`);
    } else {
      logger.warn(`No ${entity} found with slug '${item.slug}' — skipping cover`);
    }
  }
}

async function seedEducation() {
  logger.info('Seeding education...');

  for (const educationData of SEED_EDUCATION) {
    const values = { ...educationData, deletedAt: null };

    const [inserted] = await db
      .insert(education)
      .values(values)
      .onConflictDoNothing({ target: education.slug })
      .returning({ id: education.id, slug: education.slug });

    const [educationRecord] = inserted
      ? [inserted]
      : await db
          .update(education)
          .set({ ...values, updatedAt: new Date() })
          .where(eq(education.slug, educationData.slug))
          .returning({ id: education.id, slug: education.slug });

    if (!educationRecord) {
      logger.warn(`Education not found after upsert attempt: ${educationData.slug}`);
      continue;
    }

    logger.info(
      `${inserted ? 'Education inserted' : 'Education updated'}: ${educationRecord.slug}`
    );
  }
}

async function seed() {
  logger.info('Starting seed...');

  const tagIdBySlug = await seedTags();
  const skillIdBySlug = await seedSkills();
  await archiveLegacyPlaceholders();
  await seedPosts(tagIdBySlug);
  await seedProjects(skillIdBySlug);
  await seedCovers(SEED_PROJECTS, 'projects', async (slug, coverUrl) => {
    const [updated] = await db
      .update(projects)
      .set({ coverUrl, updatedAt: new Date() })
      .where(eq(projects.slug, slug))
      .returning({ id: projects.id });
    return !!updated;
  });
  await seedCovers(SEED_POSTS, 'posts', async (slug, coverUrl) => {
    const [updated] = await db
      .update(posts)
      .set({ coverUrl, updatedAt: new Date() })
      .where(eq(posts.slug, slug))
      .returning({ id: posts.id });
    return !!updated;
  });
  await seedExperience(skillIdBySlug);
  await seedEducation();

  logger.info('Seed complete.');
}

if (import.meta.main) {
  const { setupLogger } = await import('../config/logger');
  await setupLogger();
  await seed();
  await pgClient.end();
  process.exit(0);
}

export { SEED_EDUCATION, SEED_EXPERIENCE, SEED_POSTS, SEED_PROJECTS, SEED_SKILLS, SEED_TAGS, seed };
