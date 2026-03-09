import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeTags } from '@/lib/data/public/home';
import { SkillsBentoBox } from '../SkillsBentoBox';

/** Server wrapper: fetches tags independently for streaming. */
export async function SkillsSection() {
  const result = await getHomeTags();
  if (result.state === 'degraded') return <SectionUnavailable />;
  if (result.state === 'empty') return null;
  return <SkillsBentoBox tags={result.data} />;
}
