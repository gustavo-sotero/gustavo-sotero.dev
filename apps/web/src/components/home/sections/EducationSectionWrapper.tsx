import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeAggregate } from '@/lib/data/public/home';
import { EducationSection } from '../EducationSection';

/** Server wrapper: resolves education from the home aggregate (single API call shared across all sections). */
export async function EducationSectionWrapper() {
  const { education } = await getHomeAggregate();
  if (education.state === 'degraded') return <SectionUnavailable />;
  if (education.state === 'empty') return null;
  return <EducationSection education={education.data} />;
}
