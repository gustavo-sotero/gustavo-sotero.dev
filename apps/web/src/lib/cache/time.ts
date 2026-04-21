import 'server-only';
import { DEVELOPER_PUBLIC_PROFILE, getExperienceLabel } from '@portfolio/shared';
import { cacheLife } from 'next/cache';

/**
 * Returns the current calendar year, cached for up to 24 h.
 * Using 'use cache' + cacheLife keeps new Date() inside a cacheable
 * server function, satisfying Next.js 16's prerender-current-time rule.
 */
export async function getCachedCurrentYear(): Promise<number> {
  'use cache';
  cacheLife({ stale: 3600, revalidate: 86400, expire: 86400 * 30 });
  return new Date().getFullYear();
}

/**
 * Returns the experience label (e.g. "4+ anos"), cached for up to 24 h.
 * Isolates new Date() from components so they remain statically prerenderable.
 */
export async function getCachedExperienceLabel(): Promise<string> {
  'use cache';
  cacheLife({ stale: 3600, revalidate: 86400, expire: 86400 * 30 });
  return getExperienceLabel(DEVELOPER_PUBLIC_PROFILE.careerStartDate);
}
