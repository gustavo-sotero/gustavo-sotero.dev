import { WifiOff } from 'lucide-react';

/**
 * Minimal inline fallback for home sections that fail to load.
 * Intentionally low-visual-weight — a subtle signal, not a jarring error block.
 */
export function SectionUnavailable() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-zinc-800 bg-zinc-900/40 px-4 py-3 text-sm text-zinc-500">
      <WifiOff className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>Seção temporariamente indisponível.</span>
    </div>
  );
}
