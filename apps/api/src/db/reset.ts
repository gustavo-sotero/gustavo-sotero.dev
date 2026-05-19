import { sql } from 'drizzle-orm';
import { db, pgClient } from '../config/db';
import { getLogger, setupLogger } from '../config/logger';

const logger = getLogger('db', 'reset');

const SEED_TABLES = [
  'post_tags',
  'project_skills',
  'experience_skills',
  'posts',
  'projects',
  'experience',
  'education',
  'tags',
  'skills',
] as const;

async function resetSeedTables(): Promise<void> {
  const tableList = SEED_TABLES.join(', ');
  logger.info(`Truncating seed tables: ${tableList}`);

  await db.execute(sql.raw(`TRUNCATE TABLE ${tableList} RESTART IDENTITY CASCADE`));

  logger.info('All seed tables cleared. Run `bun run db:seed` to repopulate.');
}

if (import.meta.main) {
  await setupLogger();
  await resetSeedTables();
  await pgClient.end();
  process.exit(0);
}
