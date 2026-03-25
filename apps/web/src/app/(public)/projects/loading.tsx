import { Skeleton } from '@/components/ui/skeleton';

export default function ProjectsLoading() {
  return (
    <div className="container mx-auto max-w-6xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
      <div className="mb-10 space-y-2">
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-9 w-40" />
        <Skeleton className="h-4 w-32" />
      </div>
      <div className="mb-8 flex gap-2">
        {['t0', 't1', 't2', 't3', 't4'].map((id) => (
          <Skeleton key={id} className="h-6 w-16 rounded-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {['c0', 'c1', 'c2', 'c3', 'c4', 'c5'].map((_id) => (
          <div
            key={_id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden"
          >
            <Skeleton className="w-full aspect-video" />
            <div className="p-5 space-y-3">
              <Skeleton className="h-5 w-3/4" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-5/6" />
              <div className="flex gap-2 pt-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-16 rounded-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
