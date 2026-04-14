import { z } from 'zod';
import { apiRuntimeFields } from './env.fields';

const envSchema = z.object(apiRuntimeFields).superRefine((data, ctx) => {
  if (data.AI_POSTS_ENABLED && !data.OPENROUTER_API_KEY) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['OPENROUTER_API_KEY'],
      message: 'OPENROUTER_API_KEY is required when AI_POSTS_ENABLED=true',
    });
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
