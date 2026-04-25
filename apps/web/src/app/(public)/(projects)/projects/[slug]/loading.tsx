import { Skeleton } from '@/components/ui/skeleton';

const skillKeys = ['skill-1', 'skill-2', 'skill-3', 'skill-4'];
const contentKeys = ['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6', 'c-7', 'c-8', 'c-9', 'c-10'];

export default function ProjectDetailLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
      {/* Cover */}
      <Skeleton className="relative w-full aspect-4/3 rounded-xl mb-10" />

      <div className="mb-8 space-y-4">
        {/* Featured badge */}
        <Skeleton className="h-6 w-20 rounded-full" />

        {/* Title */}
        <Skeleton className="h-9 w-3/4" />

        {/* Description */}
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-2/3" />

        {/* Skills */}
        <div className="flex flex-wrap gap-2 pt-2">
          {skillKeys.map((k) => (
            <Skeleton key={k} className="h-6 w-16 rounded-full" />
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap gap-3 pt-2">
          <Skeleton className="h-9 w-32 rounded-md" />
          <Skeleton className="h-9 w-28 rounded-md" />
        </div>
      </div>

      {/* Content lines */}
      <div className="space-y-3">
        {contentKeys.map((k, i) => (
          <Skeleton key={k} className={`h-4 ${i % 5 === 4 ? 'w-2/3' : 'w-full'}`} />
        ))}
      </div>
    </div>
  );
}
