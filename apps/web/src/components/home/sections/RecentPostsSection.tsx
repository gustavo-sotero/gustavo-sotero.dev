import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeAggregate } from '@/lib/data/public/home';
import { RecentPosts } from '../RecentPosts';

/** Server wrapper: resolves posts from the home aggregate (single API call shared across all sections). */
export async function RecentPostsSection() {
  const { posts } = await getHomeAggregate();
  if (posts.state === 'degraded') return <SectionUnavailable />;
  if (posts.state === 'empty') return null;
  return <RecentPosts posts={posts.data} />;
}
