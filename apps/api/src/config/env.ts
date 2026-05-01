import { z } from 'zod';
import { apiRuntimeFields } from './env.fields';

/** Public browser-facing URL fields that must use HTTPS in production. */
const PUBLIC_HTTPS_FIELDS = ['ALLOWED_ORIGIN', 'API_PUBLIC_URL', 'GITHUB_CALLBACK_URL'] as const;

const envSchema = z.object(apiRuntimeFields).superRefine((data, ctx) => {
  if (data.AI_POSTS_ENABLED && !data.OPENROUTER_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['OPENROUTER_API_KEY'],
      message: 'OPENROUTER_API_KEY is required when AI_POSTS_ENABLED=true',
    });
  }

  if (data.NODE_ENV === 'production') {
    for (const field of PUBLIC_HTTPS_FIELDS) {
      const value = data[field];
      if (typeof value === 'string' && value.startsWith('http://')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [field],
          message: `${field} must use HTTPS in production`,
        });
      }
    }
  }
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:');
  for (const issue of parsed.error.issues) {
    console.error(`  - ${issue.path.join('.')}: ${issue.message}`);
  }
  process.exit(1);
}

export const env = parsed.data;
export type Env = typeof env;
