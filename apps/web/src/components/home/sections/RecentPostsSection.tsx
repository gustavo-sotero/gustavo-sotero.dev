import { SectionUnavailable } from '@/components/shared/SectionUnavailable';
import { getHomeRecentPosts } from '@/lib/data/public/home';
import { RecentPosts } from '../RecentPosts';

/** Server wrapper: fetches recent posts independently for streaming. */
export async function RecentPostsSection() {
  const result = await getHomeRecentPosts();
  if (result.state === 'degraded') return <SectionUnavailable />;
  if (result.state === 'empty') return null;
  return <RecentPosts posts={result.data} />;
}
