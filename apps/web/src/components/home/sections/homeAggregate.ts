import { getHomeAggregate, type HomeAggregate } from '@/lib/data/public/home';

export interface HomeAggregateSectionProps {
  aggregatePromise?: Promise<HomeAggregate>;
}

export function resolveHomeAggregate(aggregatePromise?: Promise<HomeAggregate>) {
  return aggregatePromise ?? getHomeAggregate();
}
