import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { FeaturedProjects } from '../FeaturedProjects';
import { type HomeAggregateSectionProps, resolveHomeAggregate } from './homeAggregate';

/** Server wrapper: resolves projects from the home aggregate (single API call shared across all sections). */
export async function FeaturedProjectsSection({
  aggregatePromise,
}: HomeAggregateSectionProps = {}) {
  const { projects } = await resolveHomeAggregate(aggregatePromise);
  if (projects.state === 'degraded') return <SectionUnavailable />;
  if (projects.state === 'empty') return null;
  return <FeaturedProjects projects={projects.data} />;
}
