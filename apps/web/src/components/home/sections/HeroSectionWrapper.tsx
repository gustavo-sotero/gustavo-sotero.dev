import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeTags } from '@/lib/data/public/home';
import { getResumeData } from '@/lib/data/public/resume';
import { HeroSection } from '../HeroSection';

/**
 * Server wrapper for HeroSection.
 * Fetches tags and resume data in parallel so the hero can render the real
 * PDF download button without an extra client-side data round-trip.
 * Falls back to empty tags (Hero shows FALLBACK_STACK) if the API is unavailable.
 */
export async function HeroSectionWrapper() {
  const [tagsResult, resumeResult] = await Promise.all([getHomeTags(), getResumeData()]);
  const tags = tagsResult.state !== 'degraded' ? tagsResult.data : [];
  const isDegraded = tagsResult.state === 'degraded' || resumeResult.state === 'degraded';

  return (
    <>
      <HeroSection tags={tags} resumeData={resumeResult.data} />
      {isDegraded ? (
        <div className="container mx-auto max-w-6xl px-4 md:px-6 lg:px-8 -mt-6">
          <SectionUnavailable />
        </div>
      ) : null}
    </>
  );
}
