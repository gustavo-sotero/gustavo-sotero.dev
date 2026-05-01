import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { SkillsBentoBox } from '../SkillsBentoBox';
import { type HomeAggregateSectionProps, resolveHomeAggregate } from './homeAggregate';

/** Server wrapper: resolves skills from the home aggregate (single API call shared across all sections). */
export async function SkillsSection({ aggregatePromise }: HomeAggregateSectionProps = {}) {
  const { skills } = await resolveHomeAggregate(aggregatePromise);
  if (skills.state === 'degraded') return <SectionUnavailable />;
  if (skills.state === 'empty') return null;
  return <SkillsBentoBox skills={skills.data} />;
}
