import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeExperience } from '@/lib/data/public/home';
import { ExperienceSection } from '../ExperienceSection';

/** Server wrapper: fetches experience entries independently for streaming. */
export async function ExperienceSectionWrapper() {
  const result = await getHomeExperience();
  if (result.state === 'degraded') return <SectionUnavailable />;
  if (result.state === 'empty') return null;
  return <ExperienceSection experience={result.data} />;
}
