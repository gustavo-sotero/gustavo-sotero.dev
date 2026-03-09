import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeEducation } from '@/lib/data/public/home';
import { EducationSection } from '../EducationSection';

/** Server wrapper: fetches education entries independently for streaming. */
export async function EducationSectionWrapper() {
  const result = await getHomeEducation();
  if (result.state === 'degraded') return <SectionUnavailable />;
  if (result.state === 'empty') return null;
  return <EducationSection education={result.data} />;
}
