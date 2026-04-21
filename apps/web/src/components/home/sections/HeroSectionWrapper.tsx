import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getCachedExperienceLabel } from '@/lib/cache/time';
import { getHomeTags } from '@/lib/data/public/home';
import { HeroSection } from '../HeroSection';

/**
 * Server wrapper for HeroSection.
 * Fetches tags in parallel with the cached experience label so the hero
 * can render without any client-side data round-trips for the copy.
 * Falls back to empty tags (Hero shows FALLBACK_STACK) if the API is unavailable.
 *
 * resume data is now fetched client-side inside HeroResumeDownloadButtonInner
 * so this wrapper stays fully static/prerenderable and never calls new Date().
 */
export async function HeroSectionWrapper() {
  const [tagsResult, experienceLabel] = await Promise.all([
    getHomeTags(),
    getCachedExperienceLabel(),
  ]);
  const tags = tagsResult.state !== 'degraded' ? tagsResult.data : [];
  const isDegraded = tagsResult.state === 'degraded';

  return (
    <>
      <HeroSection tags={tags} experienceLabel={experienceLabel} />
      {isDegraded ? (
        <div className="container mx-auto max-w-6xl px-4 md:px-6 lg:px-8 -mt-6">
          <SectionUnavailable />
        </div>
      ) : null}
    </>
  );
}
