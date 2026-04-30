import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeAggregate } from '@/lib/data/public/home';
import { FeaturedProjects } from '../FeaturedProjects';

/** Server wrapper: resolves projects from the home aggregate (single API call shared across all sections). */
export async function FeaturedProjectsSection() {
  const { projects } = await getHomeAggregate();
  if (projects.state === 'degraded') return <SectionUnavailable />;
  if (projects.state === 'empty') return null;
  return <FeaturedProjects projects={projects.data} />;
}
