'use client';

import { Skeleton } from '@/components/ui/skeleton';

export function CommentCardSkeleton() {
  return (
    <div className="space-y-3 rounded-lg border border-zinc-800 bg-zinc-900/60 p-5">
      <div className="flex items-start justify-between gap-4">
        <Skeleton className="h-4 w-32 bg-zinc-800" />
        <Skeleton className="h-5 w-20 rounded-full bg-zinc-800" />
      </div>
      <Skeleton className="h-3 w-48 bg-zinc-800" />
      <Skeleton className="h-16 w-full bg-zinc-800" />
      <div className="flex gap-2">
        <Skeleton className="h-8 w-24 rounded bg-zinc-800" />
        <Skeleton className="h-8 w-24 rounded bg-zinc-800" />
      </div>
    </div>
  );
}
