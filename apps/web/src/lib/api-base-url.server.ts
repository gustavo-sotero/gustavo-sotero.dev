import 'server-only';
import { z } from 'zod';

const apiBaseEnvSchema = z.object({
  API_INTERNAL_URL: z.string().url().optional(),
  NEXT_PUBLIC_API_URL: z.string().url(),
});

/**
 * Resolve the server-side API base URL with a deterministic precedence:
 * 1) API_INTERNAL_URL (container-to-container network)
 * 2) NEXT_PUBLIC_API_URL (public fallback)
 */
export function resolveServerApiBaseUrl(): string {
  const parsed = apiBaseEnvSchema.safeParse({
    API_INTERNAL_URL: process.env.API_INTERNAL_URL,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
  });

  if (!parsed.success) {
    console.error(
      '❌ Invalid API base URL environment variables:',
      parsed.error.flatten().fieldErrors
    );
    throw new Error('Invalid API base URL environment variables');
  }

  return (parsed.data.API_INTERNAL_URL ?? parsed.data.NEXT_PUBLIC_API_URL).replace(/\/+$/, '');
}
