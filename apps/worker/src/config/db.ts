/**
 * PostgreSQL + Drizzle instance for the Worker process.
 * Imports schema from packages/shared via `@portfolio/shared/db/schema`.
 */

import * as schema from '@portfolio/shared/db/schema';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import { env } from './env';

const client = postgres(env.DATABASE_URL, { max: 5 });
export const db = drizzle(client, { schema });
export { client };
