import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeAggregate } from '@/lib/data/public/home';
import { ExperienceSection } from '../ExperienceSection';

/** Server wrapper: resolves experience from the home aggregate (single API call shared across all sections). */
export async function ExperienceSectionWrapper() {
  const { experience } = await getHomeAggregate();
  if (experience.state === 'degraded') return <SectionUnavailable />;
  if (experience.state === 'empty') return null;
  return <ExperienceSection experience={experience.data} />;
}
