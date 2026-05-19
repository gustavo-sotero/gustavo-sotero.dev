import * as schema from '@portfolio/shared/db/schema';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { waitForDatabaseStartup } from './db.startup';
import { databaseEnv } from './env.database';
import { getLogger } from './logger';

const databaseHost = new URL(databaseEnv.DATABASE_URL).hostname;

// Create the postgres connection pool
const client = postgres(databaseEnv.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
});

// Create the Drizzle ORM instance
export const db = drizzle(client, { schema });

export async function waitForDatabaseReady(): Promise<void> {
  await waitForDatabaseStartup({
    host: databaseHost,
    log: getLogger('db', 'startup'),
    probe: async () => {
      await db.execute(sql`SELECT 1`);
    },
  });
}

// Export the raw client for graceful shutdown (client.end())
export { client as pgClient };
