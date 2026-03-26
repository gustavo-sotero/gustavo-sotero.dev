import { fileURLToPath } from 'node:url';
import { config as loadEnv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';

const rootEnvPath = fileURLToPath(new URL('../../.env', import.meta.url));

loadEnv({ path: rootEnvPath, override: false, quiet: true });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL environment variable is required');

export default defineConfig({
  schema: '../../packages/shared/src/db/schema/index.ts',
  out: '../../drizzle/',
  dialect: 'postgresql',
  dbCredentials: {
    url: databaseUrl,
  },
});
