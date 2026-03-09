import { posts, postTags, projects, projectTags, tags } from '@portfolio/shared/db/schema';
import { resolveTagIcon } from '@portfolio/shared/lib/iconResolver';
import { and, eq, isNull } from 'drizzle-orm';
import { db, pgClient } from '../config/db';
import { getLogger } from '../config/logger';

const logger = getLogger('db', 'seed');

// Raw definitions without iconKey — resolver assigns it automatically.
const _RAW_SEED_TAGS = [
  { name: 'TypeScript', slug: 'typescript', category: 'language' as const },
  { name: 'JavaScript', slug: 'javascript', category: 'language' as const },
  { name: 'Node.js', slug: 'nodejs', category: 'language' as const },
  { name: 'React', slug: 'react', category: 'framework' as const },
  { name: 'Next.js', slug: 'nextjs', category: 'framework' as const },
  { name: 'Hono', slug: 'hono', category: 'framework' as const },
  { name: 'Tailwind CSS', slug: 'tailwind', category: 'framework' as const },
  { name: 'PostgreSQL', slug: 'postgresql', category: 'db' as const },
  { name: 'Redis', slug: 'redis', category: 'db' as const },
  { name: 'Docker', slug: 'docker', category: 'tool' as const },
  { name: 'Bun', slug: 'bun', category: 'tool' as const },
  { name: 'Drizzle ORM', slug: 'drizzle', category: 'tool' as const },
  { name: 'Vitest', slug: 'vitest', category: 'tool' as const },
  { name: 'AWS', slug: 'aws', category: 'cloud' as const },
  { name: 'Cloudflare', slug: 'cloudflare', category: 'cloud' as const },
  { name: 'Kubernetes', slug: 'kubernetes', category: 'infra' as const },
  { name: 'Prometheus', slug: 'prometheus', category: 'infra' as const },
];

/**
 * Exported for testing — iconKey is auto-resolved via the resolver.
 * All entries will always have a non-empty iconKey.
 */
export const SEED_TAGS = _RAW_SEED_TAGS.map((t) => ({
  ...t,
  iconKey: resolveTagIcon(t.name, t.category).iconKey,
}));

const SEED_POSTS = [
  {
    slug: 'building-fullstack-portfolio',
    title: 'Building a Fullstack Portfolio with Bun and Hono',
    excerpt:
      'A deep dive into building a production-ready portfolio API with Bun, Hono, Drizzle ORM and BullMQ.',
    content: `# Building a Fullstack Portfolio with Bun and Hono

## Overview

This post covers the architecture decisions behind building a modern fullstack portfolio.

## Tech Stack

We chose the following stack:

- **Bun** — fast JavaScript runtime
- **Hono** — lightweight web framework
- **Drizzle ORM** — type-safe SQL ORM
- **PostgreSQL** — reliable relational DB
- **BullMQ** — queue-based background jobs
- **Redis** — caching and rate limiting

## Code Example

\`\`\`typescript
const app = new Hono()

app.get('/health', (c) => {
  return c.json({ status: 'ok' })
})
\`\`\`

## Architecture

\`\`\`mermaid
graph TD
  Client --> API
  API --> DB[(PostgreSQL)]
  API --> Cache[(Redis)]
  API --> Queue[BullMQ]
  Queue --> Worker
\`\`\`

## Conclusion

This stack provides an excellent developer experience with strong type safety throughout.
`,
    status: 'published' as const,
    publishedAt: new Date('2026-01-15'),
    tagSlugs: ['typescript', 'bun', 'hono', 'postgresql'],
  },
  {
    slug: 'drizzle-orm-guide',
    title: 'Drizzle ORM: A Practical Guide',
    excerpt:
      'Everything you need to know about Drizzle ORM for building type-safe database queries.',
    content: `# Drizzle ORM: A Practical Guide

## Introduction

Drizzle ORM is a TypeScript-first ORM that provides excellent type safety.

## Schema Definition

\`\`\`typescript
import { pgTable, serial, varchar } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 255 }).notNull(),
})
\`\`\`

## Querying

\`\`\`typescript
const result = await db.select().from(users).where(eq(users.id, 1))
\`\`\`
`,
    status: 'draft' as const,
    publishedAt: null,
    tagSlugs: ['typescript', 'drizzle', 'postgresql'],
  },
  {
    slug: 'bullmq-background-jobs',
    title: 'Background Jobs with BullMQ',
    excerpt: 'How to implement reliable background job processing with BullMQ and Redis.',
    content: `# Background Jobs with BullMQ

## Why queues?

Decoupling slow operations from the HTTP request cycle improves reliability.

## Example

\`\`\`typescript
const queue = new Queue('email', { connection })
await queue.add('send', { to: 'user@example.com' })
\`\`\`
`,
    status: 'draft' as const,
    publishedAt: null,
    tagSlugs: ['typescript', 'redis', 'nodejs'],
  },
];

const SEED_PROJECTS = [
  {
    slug: 'fullstack-portfolio',
    title: 'Fullstack Portfolio',
    description:
      'A production-ready fullstack portfolio built with Bun, Hono, Drizzle, and Next.js.',
    content: `# Fullstack Portfolio

## Overview

A backend-centric portfolio demonstrating advanced architectural patterns including:

- Queue-based background jobs
- Redis caching strategies
- S3 image upload pipeline
- GitHub OAuth authentication
- CSRF protection

## Stack

| Layer     | Technology     |
| --------- | -------------- |
| API       | Bun + Hono     |
| ORM       | Drizzle + PG   |
| Queues    | BullMQ + Redis |
| Frontend  | Next.js 16     |
| Deploy    | Docker + Dokploy |
`,
    status: 'published' as const,
    repositoryUrl: 'https://github.com/example/portfolio',
    liveUrl: 'https://portfolio.example.com',
    featured: true,
    order: 1,
    tagSlugs: ['typescript', 'bun', 'hono', 'nextjs', 'postgresql', 'redis', 'docker'],
  },
  {
    slug: 'open-source-contributions',
    title: 'Open Source Contributions',
    description: 'Various open source contributions and experiments.',
    content: `# Open Source Contributions

A collection of open source work and experiments.

## Projects

- Various TypeScript utilities
- React components
- Developer tooling
`,
    status: 'draft' as const,
    repositoryUrl: null,
    liveUrl: null,
    featured: false,
    order: 2,
    tagSlugs: ['typescript', 'react'],
  },
];

async function seed() {
  logger.info('Starting seed...');

  // ── Tags ─────────────────────────────────────────────────────────────────────
  logger.info('Seeding tags...');
  const insertedTags = await db
    .insert(tags)
    .values(SEED_TAGS)
    .onConflictDoNothing({ target: tags.slug })
    .returning({ id: tags.id, slug: tags.slug });

  // Backfill iconKey for predefined tags that already existed with NULL iconKey
  // (handles legacy environments seeded before iconKey was required)
  let backfillCount = 0;
  for (const tag of SEED_TAGS) {
    if (tag.iconKey) {
      const updated = await db
        .update(tags)
        .set({ iconKey: tag.iconKey })
        .where(and(eq(tags.slug, tag.slug), isNull(tags.iconKey)))
        .returning({ id: tags.id });
      backfillCount += updated.length;
    }
  }
  if (backfillCount > 0) {
    logger.info(`Backfilled iconKey for ${backfillCount} tag(s)`);
  }

  // Fetch all tags to get IDs (including pre-existing ones)
  const allTags = await db.select({ id: tags.id, slug: tags.slug }).from(tags);

  const tagIdBySlug = Object.fromEntries(allTags.map((t) => [t.slug, t.id]));
  logger.info(`Tags ready: ${allTags.length} total, ${insertedTags.length} newly inserted`);

  // ── Posts ─────────────────────────────────────────────────────────────────────
  logger.info('Seeding posts...');
  for (const post of SEED_POSTS) {
    const { tagSlugs, ...postData } = post;

    const [inserted] = await db
      .insert(posts)
      .values(postData)
      .onConflictDoNothing({ target: posts.slug })
      .returning({ id: posts.id, slug: posts.slug });

    const postRecord =
      inserted ?? (await db.query.posts.findFirst({ where: eq(posts.slug, postData.slug) }));

    if (!postRecord) {
      logger.warn(`Post not found after upsert attempt: ${postData.slug}`);
      continue;
    }

    if (inserted) {
      logger.info(`Post inserted: ${inserted.slug}`);
    } else {
      logger.info(`Post already exists: ${postData.slug}`);
    }

    const pivots = tagSlugs
      .map((s) => tagIdBySlug[s])
      .filter((id): id is number => id !== undefined)
      .map((tagId) => ({ postId: postRecord.id, tagId }));

    if (pivots.length > 0) {
      await db.insert(postTags).values(pivots).onConflictDoNothing();
    }
  }

  // ── Projects ─────────────────────────────────────────────────────────────────
  logger.info('Seeding projects...');
  for (const project of SEED_PROJECTS) {
    const { tagSlugs, ...projectData } = project;

    const [inserted] = await db
      .insert(projects)
      .values(projectData)
      .onConflictDoNothing({ target: projects.slug })
      .returning({ id: projects.id, slug: projects.slug });

    const projectRecord =
      inserted ??
      (await db.query.projects.findFirst({ where: eq(projects.slug, projectData.slug) }));

    if (!projectRecord) {
      logger.warn(`Project not found after upsert attempt: ${projectData.slug}`);
      continue;
    }

    if (inserted) {
      logger.info(`Project inserted: ${inserted.slug}`);
    } else {
      logger.info(`Project already exists: ${projectData.slug}`);
    }

    const pivots = tagSlugs
      .map((s) => tagIdBySlug[s])
      .filter((id): id is number => id !== undefined)
      .map((tagId) => ({ projectId: projectRecord.id, tagId }));

    if (pivots.length > 0) {
      await db.insert(projectTags).values(pivots).onConflictDoNothing();
    }
  }

  logger.info('Seed complete.');
}

// Allow running directly: bun run src/db/seed.ts
if (import.meta.main) {
  const { setupLogger } = await import('../config/logger');
  await setupLogger();
  await seed();
  await pgClient.end();
  process.exit(0);
}

export { seed };
