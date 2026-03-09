'use client';

/**
 * HeroResumeDownloadButton — SSR-safe wrapper.
 *
 * `@react-pdf/renderer` is client-only. Loading the inner component with
 * `{ ssr: false }` keeps the dependency out of the SSR bundle, mirroring the
 * exact same pattern used by ResumeDownloadButton on the /curriculo page.
 */

import { Download } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import type { ResumeViewModel } from '@/lib/resume/mapper';

const HeroResumeDownloadButtonInner = dynamic(
  () => import('./HeroResumeDownloadButtonInner').then((mod) => mod.HeroResumeDownloadButtonInner),
  {
    ssr: false,
    loading: () => (
      <ShimmerButton
        disabled
        background="rgba(5, 150, 105, 1)"
        shimmerColor="#34d399"
        borderRadius="8px"
        className="text-sm font-semibold px-6 py-2.5 shadow-lg shadow-emerald-500/20 opacity-60 cursor-not-allowed"
      >
        <Download className="h-4 w-4 shrink-0 mr-2" />
        Baixar Currículo
      </ShimmerButton>
    ),
  }
);

export function HeroResumeDownloadButton({ resume }: { resume: ResumeViewModel }) {
  return <HeroResumeDownloadButtonInner resume={resume} />;
}
