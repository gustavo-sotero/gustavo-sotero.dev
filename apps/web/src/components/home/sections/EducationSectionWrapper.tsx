import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { EducationSection } from '../EducationSection';
import { type HomeAggregateSectionProps, resolveHomeAggregate } from './homeAggregate';

/** Server wrapper: resolves education from the home aggregate (single API call shared across all sections). */
export async function EducationSectionWrapper({
  aggregatePromise,
}: HomeAggregateSectionProps = {}) {
  const { education } = await resolveHomeAggregate(aggregatePromise);
  if (education.state === 'degraded') return <SectionUnavailable />;
  if (education.state === 'empty') return null;
  return <EducationSection education={education.data} />;
}
