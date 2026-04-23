import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeSkills } from '@/lib/data/public/home';
import { SkillsBentoBox } from '../SkillsBentoBox';

/** Server wrapper: fetches skills independently for streaming. */
export async function SkillsSection() {
  const result = await getHomeSkills();
  if (result.state === 'degraded') return <SectionUnavailable />;
  if (result.state === 'empty') return null;
  return <SkillsBentoBox tags={result.data} />;
}
