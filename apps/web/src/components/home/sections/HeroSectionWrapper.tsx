import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getCachedExperienceLabel } from '@/lib/cache/time';
import { getHomeAggregate } from '@/lib/data/public/home';
import { HeroSection } from '../HeroSection';

/**
 * Server wrapper for HeroSection.
 * Skills are resolved from the home aggregate (shared cache entry with all other
 * home sections) so the hero participates in the same single round-trip budget.
 * Falls back to empty skills (Hero shows FALLBACK_STACK) if the API is unavailable.
 *
 * resume data is now fetched client-side inside HeroResumeDownloadButtonInner
 * so this wrapper stays fully static/prerenderable and never calls new Date().
 */
export async function HeroSectionWrapper() {
  const [{ skills: skillsResult }, experienceLabel] = await Promise.all([
    getHomeAggregate(),
    getCachedExperienceLabel(),
  ]);
  const skills = skillsResult.state !== 'degraded' ? skillsResult.data : [];
  const isDegraded = skillsResult.state === 'degraded';

  return (
    <>
      <HeroSection skills={skills} experienceLabel={experienceLabel} />
      {isDegraded ? (
        <div className="container mx-auto max-w-6xl px-4 md:px-6 lg:px-8 -mt-6">
          <SectionUnavailable />
        </div>
      ) : null}
    </>
  );
}
