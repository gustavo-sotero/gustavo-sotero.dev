/**
 * ResumeDownloadButton — public surface used by Server and Client Components.
 *
 * `@react-pdf/renderer` is client-only and incompatible with Turbopack SSR
 * compilation. By loading the inner component with `{ ssr: false }`, the
 * entire @react-pdf dependency tree is partitioned to the browser bundle and
 * never touched during the SSR pass.
 */
'use client';

import { Loader2 } from 'lucide-react';
import dynamic from 'next/dynamic';
import type { ResumeDownloadButtonProps } from './ResumeDownloadButtonInner';

export type { ResumeDownloadButtonProps };

// ---------------------------------------------------------------------------
// Loading skeleton — rendered while the client bundle is fetched.
// Accepts variant so the placeholder matches the final button shape.
// ---------------------------------------------------------------------------

function LoadingSkeleton({ variant = 'primary' }: { variant?: 'primary' | 'outline' }) {
  const base =
    'inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-medium cursor-not-allowed opacity-60 transition-all';
  const variantClass =
    variant === 'primary'
      ? 'bg-emerald-500 text-zinc-950'
      : 'border border-zinc-700 text-zinc-300 bg-transparent';
  return (
    <span className={`${base} ${variantClass}`}>
      <Loader2 className="h-4 w-4 animate-spin" />
      Carregando PDF...
    </span>
  );
}

// ---------------------------------------------------------------------------
// Dynamic import — ssr:false ensures @react-pdf/renderer is never compiled
// during SSR. Turbopack won't attempt to resolve its module IDs server-side.
// ---------------------------------------------------------------------------

const ResumeDownloadButtonInner = dynamic(
  () => import('./ResumeDownloadButtonInner').then((mod) => mod.ResumeDownloadButtonInner),
  {
    ssr: false,
    loading: () => <LoadingSkeleton />,
  }
);

// ---------------------------------------------------------------------------
// Public wrapper — passes variant to both the loading skeleton and the inner
// button once the bundle has loaded.
// ---------------------------------------------------------------------------

export function ResumeDownloadButton({
  resume,
  generatedAt,
  variant = 'primary',
  className = '',
}: ResumeDownloadButtonProps) {
  return (
    <ResumeDownloadButtonInner
      resume={resume}
      generatedAt={generatedAt}
      variant={variant}
      className={className}
    />
  );
}
