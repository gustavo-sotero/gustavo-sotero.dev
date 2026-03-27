import { revalidateTag } from 'next/cache';
import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { serverEnv } from '@/lib/env.server';
import { logServerError } from '@/lib/server-logger';

const MAX_TAGS = 20;
const TAG_PATTERN = /^public:[a-z0-9:_-]{1,100}$/;

const bodySchema = z.object({
  tags: z
    .array(z.string())
    .min(1, 'At least one tag is required')
    .max(MAX_TAGS, `Max ${MAX_TAGS} tags per request`),
});

type AuthResult = { ok: true } | { ok: false; status: 401 | 403 };

/**
 * Authenticates the request via `x-revalidate-secret` header only.
 */
function authenticate(req: NextRequest): AuthResult {
  const secretHeader = req.headers.get('x-revalidate-secret');
  if (!secretHeader) return { ok: false, status: 401 };

  const expected = serverEnv.REVALIDATE_SECRET;
  const encoder = new TextEncoder();
  const a = encoder.encode(secretHeader);
  const b = encoder.encode(expected);
  if (a.length !== b.length) return { ok: false, status: 403 };
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  if (diff !== 0) return { ok: false, status: 403 };

  return { ok: true };
}

/**
 * POST /_internal/revalidate
 *
 * Revalidates Next.js App Router cache entries by tag.
 * Designed for server-to-server calls with `x-revalidate-secret` header.
 * Internal admin browser calls should use Server Actions
 * (see lib/actions/revalidate-tags.ts).
 *
 * This route lives under /_internal/ so it does not collide with the public
 * /api/* namespace that the Hono API now occupies via the proxy StripPrefix.
 *
 * Body: `{ tags: string[] }`
 * Response: `{ revalidated: string[], invalid: string[], count: number }`
 */
export async function POST(req: NextRequest) {
  const auth = authenticate(req);
  if (!auth.ok) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: auth.status === 401 ? 'UNAUTHORIZED' : 'FORBIDDEN',
          message: auth.status === 401 ? 'Not authenticated' : 'Invalid revalidation secret',
        },
      },
      { status: auth.status }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'VALIDATION_ERROR', message: 'Invalid JSON body' } },
      { status: 400 }
    );
  }

  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'Invalid payload',
          details: parsed.error.flatten().fieldErrors,
        },
      },
      { status: 400 }
    );
  }

  const { tags } = parsed.data;
  const invalid = tags.filter((tag) => !TAG_PATTERN.test(tag));
  const valid = tags.filter((tag) => TAG_PATTERN.test(tag));

  if (valid.length === 0) {
    return NextResponse.json(
      {
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'No valid public cache tags were provided',
          details: { invalid },
        },
      },
      { status: 400 }
    );
  }

  const revalidated: string[] = [];

  try {
    for (const tag of valid) {
      revalidateTag(tag, 'max');
      revalidated.push(tag);
    }
  } catch (err) {
    logServerError('/_internal/revalidate', 'Unexpected error during revalidation', {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { success: false, error: { code: 'INTERNAL_ERROR', message: 'Revalidation failed' } },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { success: true, data: { revalidated, invalid, count: revalidated.length } },
    { status: 200 }
  );
}
