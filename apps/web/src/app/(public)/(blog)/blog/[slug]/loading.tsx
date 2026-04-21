import { Skeleton } from '@/components/ui/skeleton';

const tagKeys = ['tag-1', 'tag-2', 'tag-3'];
const contentKeys = ['c-1', 'c-2', 'c-3', 'c-4', 'c-5', 'c-6', 'c-7', 'c-8', 'c-9', 'c-10'];

export default function BlogDetailLoading() {
  return (
    <div className="container mx-auto max-w-3xl px-4 md:px-6 lg:px-8 py-12 md:py-16">
      {/* Cover */}
      <Skeleton className="relative w-full aspect-4/3 rounded-xl mb-10" />

      <div className="mb-8 space-y-4">
        {/* Tags */}
        <div className="flex flex-wrap gap-2">
          {tagKeys.map((k) => (
            <Skeleton key={k} className="h-6 w-16 rounded-full" />
          ))}
        </div>

        {/* Title */}
        <Skeleton className="h-9 w-4/5" />

        {/* Excerpt */}
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-2/3" />

        {/* Meta — date + reading time */}
        <div className="flex items-center gap-4">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-4 w-24" />
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
