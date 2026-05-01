import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { RecentPosts } from '../RecentPosts';
import { type HomeAggregateSectionProps, resolveHomeAggregate } from './homeAggregate';

/** Server wrapper: resolves posts from the home aggregate (single API call shared across all sections). */
export async function RecentPostsSection({ aggregatePromise }: HomeAggregateSectionProps = {}) {
  const { posts } = await resolveHomeAggregate(aggregatePromise);
  if (posts.state === 'degraded') return <SectionUnavailable />;
  if (posts.state === 'empty') return null;
  return <RecentPosts posts={posts.data} />;
}
