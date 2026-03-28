#!/usr/bin/env bun
/**
 * verify-admin-routes.ts
 *
 * Verifies that required admin routes are present in the built Next.js output
 * and can optionally be probed over HTTP against a running standalone server.
 *
 * Usage (after `bun run build` in apps/web):
 *   bun scripts/verify-admin-routes.ts
 *   bun scripts/verify-admin-routes.ts --next-dir apps/web/.next
 *   bun scripts/verify-admin-routes.ts --probe-url http://localhost:3001/admin/uploads
 *
 * Exit code 0  — all routes found
 * Exit code 1  — one or more routes missing (details printed to stderr)
 *
 * Design notes:
 *  - Manifest validation is safe to run immediately after the web build step.
 *  - Optional HTTP probing validates that a running artifact does not resolve
 *    the checked route to the custom 404 page.
 *  - Uses the app-paths-manifest because it is the canonical Next.js record of
 *    every App Router page that was compiled into the standalone output.
 *  - Extend REQUIRED_ADMIN_ROUTES when new protected pages are added.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const DEFAULT_PROBE_TIMEOUT_MS = 10_000;
const NOT_FOUND_MARKERS = [
  'Pagina nao encontrada',
  'Página não encontrada',
  'Error: 404 Not Found',
];
const NEXT_REDIRECT_MARKERS = ['NEXT_REDIRECT;', '__next-page-redirect'];

// ── Required routes ──────────────────────────────────────────────────────────
// Add new admin routes here when they are created. The key must match the
// route segment path as it appears in the Next.js app-paths manifest
// (e.g. "/admin/uploads" maps to the page at
//  apps/web/src/app/(admin)/admin/(protected)/uploads/page.tsx).

const REQUIRED_ADMIN_ROUTES: ReadonlyArray<string> = [
  '/admin/uploads',
  '/admin/posts/new',
  '/admin/projects/new',
  '/admin/posts',
  '/admin/projects',
  '/admin',
  '/admin/login',
];

// ── Resolve arguments ────────────────────────────────────────────────────────

interface VerifyArgs {
  nextDir: string;
  probeUrl?: string;
  timeoutMs: number;
}

function parseArgs(): VerifyArgs {
  const args = process.argv.slice(2);
  const nextDirFlagIndex = args.indexOf('--next-dir');
  const probeUrlFlagIndex = args.indexOf('--probe-url');
  const timeoutFlagIndex = args.indexOf('--timeout-ms');
  const nextDirArg = nextDirFlagIndex !== -1 ? args[nextDirFlagIndex + 1] : undefined;
  const probeUrlArg = probeUrlFlagIndex !== -1 ? args[probeUrlFlagIndex + 1] : undefined;
  const timeoutArg = timeoutFlagIndex !== -1 ? args[timeoutFlagIndex + 1] : undefined;

  const nextDir = nextDirArg ? resolve(nextDirArg) : resolve('apps/web/.next');

  const probeUrl = probeUrlArg || undefined;

  const timeoutMsRaw = timeoutArg ? Number(timeoutArg) : DEFAULT_PROBE_TIMEOUT_MS;

  const timeoutMs =
    Number.isFinite(timeoutMsRaw) && timeoutMsRaw > 0 ? timeoutMsRaw : DEFAULT_PROBE_TIMEOUT_MS;

  return { nextDir, probeUrl, timeoutMs };
}

function normalizeForMarkerMatch(content: string): string {
  return content
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function normalizeManifestRouteKey(key: string): string {
  const withoutRouteGroups = key.replace(/\/\([^/]+\)/g, '');
  const withoutTerminalSegment = withoutRouteGroups.replace(/\/(?:page|route)$/, '');

  return withoutTerminalSegment.length > 0 ? withoutTerminalSegment : '/';
}

function extractNextRedirectTarget(body: string): string | null {
  const metaRedirectMatch = body.match(
    /<meta[^>]+id="__next-page-redirect"[^>]+content="\d+;url=([^"]+)"/i
  );

  if (metaRedirectMatch?.[1]) {
    return metaRedirectMatch[1];
  }

  const digestRedirectMatch = body.match(/NEXT_REDIRECT;[^;]+;([^;]+);\d+;/i);

  if (digestRedirectMatch?.[1]) {
    return digestRedirectMatch[1];
  }

  return null;
}

async function probeRoute(url: string, timeoutMs: number): Promise<void> {
  const abortController = new AbortController();
  const timer = setTimeout(() => abortController.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      redirect: 'follow',
      signal: abortController.signal,
    });

    const body = await response.text();
    const normalizedBody = normalizeForMarkerMatch(body);
    const nextRedirectTarget = extractNextRedirectTarget(body);
    const matchedRedirectMarker = NEXT_REDIRECT_MARKERS.find((marker) =>
      normalizedBody.includes(normalizeForMarkerMatch(marker))
    );
    const matchedMarker = NOT_FOUND_MARKERS.find((marker) =>
      normalizedBody.includes(normalizeForMarkerMatch(marker))
    );

    if (nextRedirectTarget || matchedRedirectMarker) {
      process.stdout.write(
        `Runtime probe passed — ${url} resolved through a Next.js redirect boundary.\n` +
          `  Final URL: ${response.url}\n` +
          `  HTTP status: ${response.status}\n` +
          `  Redirect target: ${nextRedirectTarget ?? 'embedded in streamed payload'}\n`
      );
      return;
    }

    if (response.status === 404 || matchedMarker) {
      process.stderr.write(
        `\nAdmin route runtime probe FAILED for ${url}\n` +
          `  Final URL: ${response.url}\n` +
          `  HTTP status: ${response.status}\n` +
          `  Reason: resolved to the custom 404 page${matchedMarker ? ` (marker: ${matchedMarker})` : ''}.\n`
      );
      process.exit(1);
    }

    if (response.status >= 500) {
      process.stderr.write(
        `\nAdmin route runtime probe FAILED for ${url}\n` +
          `  Final URL: ${response.url}\n` +
          `  HTTP status: ${response.status}\n` +
          '  Reason: server returned a 5xx response while probing the route.\n'
      );
      process.exit(1);
    }

    process.stdout.write(
      `Runtime probe passed — ${url} resolved without the custom 404 page.\n` +
        `  Final URL: ${response.url}\n` +
        `  HTTP status: ${response.status}\n`
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    process.stderr.write(`\nAdmin route runtime probe FAILED for ${url}\n  Error: ${message}\n`);
    process.exit(1);
  } finally {
    clearTimeout(timer);
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { nextDir, probeUrl, timeoutMs } = parseArgs();
  const manifestPath = join(nextDir, 'server', 'app-paths-manifest.json');

  if (!existsSync(manifestPath)) {
    process.stderr.write(
      `ERROR: app-paths-manifest.json not found at ${manifestPath}\n` +
        `       Run 'bun run build' inside apps/web before verification.\n`
    );
    process.exit(1);
  }

  let manifest: Record<string, string>;

  try {
    manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as Record<string, string>;
  } catch (err) {
    process.stderr.write(`ERROR: Failed to parse ${manifestPath}: ${(err as Error).message}\n`);
    process.exit(1);
  }

  // The manifest keys are the route paths as known to Next.js.
  // Route groups (parentheses) are stripped by Next.js in the manifest keys,
  // so "/admin/uploads" appears as-is regardless of the (protected) group.
  const manifestKeys = Object.keys(manifest);
  const normalizedManifestKeys = new Set(manifestKeys.map(normalizeManifestRouteKey));

  const missing: string[] = [];

  for (const route of REQUIRED_ADMIN_ROUTES) {
    // An exact match is the primary check. Some routes additionally appear as
    // "<route>/page" — accept either form.
    const present = normalizedManifestKeys.has(route);

    if (!present) {
      missing.push(route);
    }
  }

  if (missing.length > 0) {
    process.stderr.write(
      `\nAdmin route verification FAILED — ${missing.length} route(s) not found in build:\n` +
        missing.map((r) => `  ✗ ${r}`).join('\n') +
        '\n\nThis may indicate:\n' +
        '  1. The page file was accidentally deleted or moved.\n' +
        '  2. A route-group rename broke the segment path.\n' +
        '  3. The production build is stale (re-deploy required).\n' +
        '  4. A proxy rule is rewriting the path before it reaches Next.js.\n\n' +
        `Manifest checked: ${manifestPath}\n`
    );
    process.exit(1);
  }

  process.stdout.write(
    `Admin route verification passed — ${REQUIRED_ADMIN_ROUTES.length} route(s) confirmed.\n` +
      REQUIRED_ADMIN_ROUTES.map((r) => `  ✓ ${r}`).join('\n') +
      '\n'
  );

  if (probeUrl) {
    await probeRoute(probeUrl, timeoutMs);
  }
}

await main();
