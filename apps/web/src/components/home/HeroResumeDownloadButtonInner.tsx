'use client';

import { usePDF } from '@react-pdf/renderer';
import { Download, Loader2 } from 'lucide-react';
import { useCallback } from 'react';
import { ResumePdfDocument } from '@/components/resume/ResumePdfDocument';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import type { ResumeViewModel } from '@/lib/resume/mapper';

const FILENAME = 'curriculo-gustavo-sotero.pdf';

export function HeroResumeDownloadButtonInner({ resume }: { resume: ResumeViewModel }) {
  const [instance] = usePDF({ document: <ResumePdfDocument resume={resume} /> });

  const handleClick = useCallback(() => {
    if (!instance.url || instance.loading) return;
    // Create a transient anchor, trigger download, then discard — no DOM pollution.
    const a = document.createElement('a');
    a.href = instance.url;
    a.download = FILENAME;
    a.click();
  }, [instance.url, instance.loading]);

  return (
    <ShimmerButton
      onClick={handleClick}
      disabled={instance.loading}
      background="rgba(5, 150, 105, 1)"
      shimmerColor="#34d399"
      borderRadius="8px"
      className="text-sm font-semibold px-6 py-2.5 shadow-lg shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    >
      {instance.loading ? (
        <Loader2 className="h-4 w-4 shrink-0 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 shrink-0 mr-2" />
      )}
      {instance.loading ? 'Gerando PDF...' : 'Baixar Currículo'}
    </ShimmerButton>
  );
}
