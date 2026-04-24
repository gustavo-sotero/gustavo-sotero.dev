import {
  experienceSkills,
  experienceTags,
  projectSkills,
  projectTags,
  skills,
  tags,
} from '@portfolio/shared/db/schema';
import { resolveTagIcon } from '@portfolio/shared/lib/iconResolver';
import { asc, eq, inArray } from 'drizzle-orm';
import { db, pgClient } from '../config/db';
import { getLogger, setupLogger } from '../config/logger';

const logger = getLogger('db', 'backfill-skills-from-tags');

const TECHNICAL_SKILL_CATEGORIES = [
  'language',
  'framework',
  'tool',
  'db',
  'cloud',
  'infra',
] as const;

type TechnicalSkillCategory = (typeof TECHNICAL_SKILL_CATEGORIES)[number];

interface SkillSourceRow {
  entityId: number;
  tagId: number;
  name: string;
  slug: string;
  category: TechnicalSkillCategory;
  isHighlighted: boolean;
}

interface ExistingSkillRow {
  id: number;
  name: string;
  slug: string;
  category: TechnicalSkillCategory;
}

interface SkillInsertRow {
  name: string;
  slug: string;
  category: TechnicalSkillCategory;
  iconKey: string | null;
  expertiseLevel: number;
  isHighlighted: number;
}

interface SkillsBackfillDeps {
  loadProjectTagRows?: () => Promise<SkillSourceRow[]>;
  loadExperienceTagRows?: () => Promise<SkillSourceRow[]>;
  listExistingSkills?: () => Promise<ExistingSkillRow[]>;
  insertSkills?: (rows: SkillInsertRow[]) => Promise<void>;
  linkProjectSkills?: (rows: Array<{ projectId: number; skillId: number }>) => Promise<void>;
  linkExperienceSkills?: (rows: Array<{ experienceId: number; skillId: number }>) => Promise<void>;
  loggerInstance?: ReturnType<typeof getLogger>;
}

interface SkillLookupMaps {
  bySlug: Map<string, ExistingSkillRow>;
  byName: Map<string, ExistingSkillRow>;
}

function normalizeLookupValue(value: string) {
  return value.trim().toLowerCase();
}

function buildSkillLookupMaps(skillRows: ExistingSkillRow[]): SkillLookupMaps {
  const bySlug = new Map<string, ExistingSkillRow>();
  const byName = new Map<string, ExistingSkillRow>();

  for (const skill of skillRows) {
    bySlug.set(normalizeLookupValue(skill.slug), skill);
    byName.set(normalizeLookupValue(skill.name), skill);
  }

  return { bySlug, byName };
}

function resolveExistingSkill(sourceRow: SkillSourceRow, lookup: SkillLookupMaps) {
  return (
    lookup.bySlug.get(normalizeLookupValue(sourceRow.slug)) ??
    lookup.byName.get(normalizeLookupValue(sourceRow.name)) ??
    null
  );
}

function uniqueByKey<T>(rows: T[], keyFn: (row: T) => string) {
  const seen = new Set<string>();
  const unique: T[] = [];

  for (const row of rows) {
    const key = keyFn(row);
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(row);
  }

  return unique;
}

async function defaultLoadProjectTagRows(): Promise<SkillSourceRow[]> {
  const rows = await db
    .select({
      entityId: projectTags.projectId,
      tagId: tags.id,
      name: tags.name,
      slug: tags.slug,
      category: tags.category,
      isHighlighted: tags.isHighlighted,
    })
    .from(projectTags)
    .innerJoin(tags, eq(projectTags.tagId, tags.id))
    .where(inArray(tags.category, TECHNICAL_SKILL_CATEGORIES))
    .orderBy(asc(projectTags.projectId), asc(tags.name));

  return rows as SkillSourceRow[];
}

async function defaultLoadExperienceTagRows(): Promise<SkillSourceRow[]> {
  const rows = await db
    .select({
      entityId: experienceTags.experienceId,
      tagId: tags.id,
      name: tags.name,
      slug: tags.slug,
      category: tags.category,
      isHighlighted: tags.isHighlighted,
    })
    .from(experienceTags)
    .innerJoin(tags, eq(experienceTags.tagId, tags.id))
    .where(inArray(tags.category, TECHNICAL_SKILL_CATEGORIES))
    .orderBy(asc(experienceTags.experienceId), asc(tags.name));

  return rows as SkillSourceRow[];
}

async function defaultListExistingSkills(): Promise<ExistingSkillRow[]> {
  const rows = await db
    .select({
      id: skills.id,
      name: skills.name,
      slug: skills.slug,
      category: skills.category,
    })
    .from(skills)
    .orderBy(asc(skills.name));

  return rows as ExistingSkillRow[];
}

async function defaultInsertSkills(rows: SkillInsertRow[]): Promise<void> {
  if (rows.length === 0) return;

  await db.insert(skills).values(rows).onConflictDoNothing();
}

async function defaultLinkProjectSkills(
  rows: Array<{ projectId: number; skillId: number }>
): Promise<void> {
  if (rows.length === 0) return;

  await db.insert(projectSkills).values(rows).onConflictDoNothing();
}

async function defaultLinkExperienceSkills(
  rows: Array<{ experienceId: number; skillId: number }>
): Promise<void> {
  if (rows.length === 0) return;

  await db.insert(experienceSkills).values(rows).onConflictDoNothing();
}

export async function runSkillsCatalogBackfill({
  loadProjectTagRows = defaultLoadProjectTagRows,
  loadExperienceTagRows = defaultLoadExperienceTagRows,
  listExistingSkills = defaultListExistingSkills,
  insertSkills = defaultInsertSkills,
  linkProjectSkills = defaultLinkProjectSkills,
  linkExperienceSkills = defaultLinkExperienceSkills,
  loggerInstance = logger,
}: SkillsBackfillDeps = {}): Promise<void> {
  const [projectTagRows, experienceTagRows, existingSkillRows] = await Promise.all([
    loadProjectTagRows(),
    loadExperienceTagRows(),
    listExistingSkills(),
  ]);

  const lookup = buildSkillLookupMaps(existingSkillRows);
  const catalogSourceRows = uniqueByKey(
    [...projectTagRows, ...experienceTagRows],
    (row) => `${normalizeLookupValue(row.slug)}:${normalizeLookupValue(row.name)}`
  );

  const missingSkillRows = catalogSourceRows
    .filter((row) => !resolveExistingSkill(row, lookup))
    .map((row) => ({
      name: row.name,
      slug: row.slug,
      category: row.category,
      iconKey: resolveTagIcon(row.name, row.category).iconKey,
      expertiseLevel: 1,
      isHighlighted: row.isHighlighted ? 1 : 0,
    }));

  const uniqueMissingSkillRows = uniqueByKey(
    missingSkillRows,
    (row) => `${normalizeLookupValue(row.slug)}:${normalizeLookupValue(row.name)}`
  );

  await insertSkills(uniqueMissingSkillRows);

  const finalLookup = buildSkillLookupMaps(await listExistingSkills());

  const unresolvedRows = catalogSourceRows.filter((row) => !resolveExistingSkill(row, finalLookup));
  if (unresolvedRows.length > 0) {
    throw new Error(`Unable to resolve ${unresolvedRows.length} skill(s) after backfill insert`);
  }

  const projectLinks = uniqueByKey(
    projectTagRows.map((row) => {
      const skill = resolveExistingSkill(row, finalLookup);
      if (!skill) {
        throw new Error(`Missing skill mapping for project tag ${row.tagId}`);
      }

      return { projectId: row.entityId, skillId: skill.id };
    }),
    (row) => `${row.projectId}:${row.skillId}`
  );

  const experienceLinks = uniqueByKey(
    experienceTagRows.map((row) => {
      const skill = resolveExistingSkill(row, finalLookup);
      if (!skill) {
        throw new Error(`Missing skill mapping for experience tag ${row.tagId}`);
      }

      return { experienceId: row.entityId, skillId: skill.id };
    }),
    (row) => `${row.experienceId}:${row.skillId}`
  );

  await Promise.all([linkProjectSkills(projectLinks), linkExperienceSkills(experienceLinks)]);

  loggerInstance.info('Skill catalog backfill completed', {
    projectTagRows: projectTagRows.length,
    experienceTagRows: experienceTagRows.length,
    createdSkills: uniqueMissingSkillRows.length,
    linkedProjectSkills: projectLinks.length,
    linkedExperienceSkills: experienceLinks.length,
  });
}

if (import.meta.main) {
  await setupLogger();

  runSkillsCatalogBackfill()
    .then(async () => {
      await pgClient.end();
    })
    .catch(async (err) => {
      logger.error('Skill catalog backfill failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      await pgClient.end();
      process.exit(1);
    });
}
