import { z } from 'zod';
import { loggerFields } from './env.fields';

/**
 * Minimal env parser for logger initialisation.
 *
 * Validates only NODE_ENV (with a safe 'development' default) so that
 * operational DB scripts and any other minimal-env contexts can initialise
 * logging without requiring unrelated runtime secrets.
 *
 * NODE_ENV has a safe default, so this parse is always infallible.
 *
 * Used by `config/logger.ts`. Do not import the full `env` export from `env.ts`
 * in contexts that only need to determine the runtime environment tier.
 */
const loggerEnvSchema = z.object(loggerFields);

// NODE_ENV has a safe default — parse is always infallible.
export const loggerEnv = loggerEnvSchema.parse(process.env);
export type LoggerEnv = typeof loggerEnv;
