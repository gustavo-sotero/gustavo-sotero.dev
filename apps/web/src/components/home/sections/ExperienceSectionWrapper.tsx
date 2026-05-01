import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { ExperienceSection } from '../ExperienceSection';
import { type HomeAggregateSectionProps, resolveHomeAggregate } from './homeAggregate';

/** Server wrapper: resolves experience from the home aggregate (single API call shared across all sections). */
export async function ExperienceSectionWrapper({
  aggregatePromise,
}: HomeAggregateSectionProps = {}) {
  const { experience } = await resolveHomeAggregate(aggregatePromise);
  if (experience.state === 'degraded') return <SectionUnavailable />;
  if (experience.state === 'empty') return null;
  return <ExperienceSection experience={experience.data} />;
}
