import { Skeleton } from '@/components/ui/skeleton';

export default function Loading() {
  return (
    <div className="container mx-auto max-w-6xl px-4 md:px-6 lg:px-8 py-12 md:py-16 space-y-8">
      <div className="space-y-2">
        <Skeleton className="h-3 w-12" />
        <Skeleton className="h-9 w-1/3" />
        <Skeleton className="h-4 w-2/3" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {['c0', 'c1', 'c2'].map((id) => (
          <div
            key={id}
            className="rounded-xl border border-zinc-800 bg-zinc-900/60 overflow-hidden"
          >
            <Skeleton className="w-full aspect-video" />
            <div className="p-5 space-y-3">
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/5" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
