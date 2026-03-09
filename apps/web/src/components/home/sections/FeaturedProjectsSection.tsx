import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeFeaturedProjects } from '@/lib/data/public/home';
import { FeaturedProjects } from '../FeaturedProjects';

/** Server wrapper: fetches projects (featured-first) independently for streaming. */
export async function FeaturedProjectsSection() {
  const result = await getHomeFeaturedProjects();
  if (result.state === 'degraded') return <SectionUnavailable />;
  if (result.state === 'empty') return null;
  return <FeaturedProjects projects={result.data} />;
}
