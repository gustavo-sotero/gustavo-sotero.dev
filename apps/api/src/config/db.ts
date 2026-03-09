import * as schema from '@portfolio/shared/db/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env';

// Create the postgres connection pool
const client = postgres(env.DATABASE_URL, {
  max: 20,
  idle_timeout: 30,
  connect_timeout: 10,
});

// Create the Drizzle ORM instance
export const db = drizzle(client, { schema });

// Export the raw client for graceful shutdown (client.end())
export { client as pgClient };
