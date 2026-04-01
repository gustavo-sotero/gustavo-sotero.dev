export default function CurriculoLoading() {
  return (
    <div className="container mx-auto max-w-4xl px-4 md:px-6 lg:px-8 py-12 md:py-16 animate-pulse">
      {/* Header row */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-12">
        <div className="space-y-2">
          <div className="h-3 w-20 bg-zinc-800 rounded" />
          <div className="h-3 w-64 bg-zinc-800 rounded" />
        </div>
        <div className="h-9 w-32 bg-zinc-800 rounded-md" />
      </div>

      {/* Section blocks */}
      {(['a', 'b', 'c', 'd'] as const).map((key) => (
        <div key={key} className="mb-10 space-y-3">
          <div className="h-4 w-40 bg-zinc-700 rounded" />
          <div className="h-3 w-full bg-zinc-800 rounded" />
          <div className="h-3 w-5/6 bg-zinc-800 rounded" />
          <div className="h-3 w-4/6 bg-zinc-800 rounded" />
        </div>
      ))}

      {/* Bottom download CTA */}
      <div className="mt-12 pt-8 border-t border-zinc-800 flex justify-center">
        <div className="h-9 w-40 bg-zinc-800 rounded-md" />
      </div>
    </div>
  );
}
