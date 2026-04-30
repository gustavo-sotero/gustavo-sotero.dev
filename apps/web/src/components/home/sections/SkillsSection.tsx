import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeAggregate } from '@/lib/data/public/home';
import { SkillsBentoBox } from '../SkillsBentoBox';

/** Server wrapper: resolves skills from the home aggregate (single API call shared across all sections). */
export async function SkillsSection() {
  const { skills } = await getHomeAggregate();
  if (skills.state === 'degraded') return <SectionUnavailable />;
  if (skills.state === 'empty') return null;
  return <SkillsBentoBox skills={skills.data} />;
}
