'use client';

import { usePDF } from '@react-pdf/renderer';
import { Download, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ResumePdfDocument } from '@/components/resume/ResumePdfDocument';
import { ShimmerButton } from '@/components/ui/shimmer-button';
import type { ResumeDataPayload } from '@/lib/data/public/resume-client';
import { getResumeDataClient } from '@/lib/data/public/resume-client';
import { buildResumeViewModel } from '@/lib/resume/mapper';

const FILENAME = 'curriculo-gustavo-sotero.pdf';

function downloadResumePdf(url: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = FILENAME;
  anchor.click();
}

export function HeroResumeDownloadButtonInner() {
  const [resumeData, setResumeData] = useState<ResumeDataPayload | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [shouldAutoDownload, setShouldAutoDownload] = useState(false);
  const loadPromiseRef = useRef<Promise<ResumeDataPayload> | null>(null);
  const isMountedRef = useRef(true);
  const now = useMemo(() => new Date(), []);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const ensureResumeData = useCallback(() => {
    if (resumeData) {
      return Promise.resolve(resumeData);
    }

    if (loadPromiseRef.current) {
      return loadPromiseRef.current;
    }

    setIsPreparing(true);

    const promise = getResumeDataClient()
      .then((data) => {
        if (isMountedRef.current) {
          setResumeData(data);
        }

        return data;
      })
      .finally(() => {
        loadPromiseRef.current = null;

        if (isMountedRef.current) {
          setIsPreparing(false);
        }
      });

    loadPromiseRef.current = promise;
    return promise;
  }, [resumeData]);

  const resume = useMemo(
    () => (resumeData ? buildResumeViewModel({ ...resumeData, now }) : null),
    [resumeData, now]
  );
  const generatedAt = useMemo(
    () => now.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' }),
    [now]
  );
  const [instance] = usePDF({
    document: resume ? <ResumePdfDocument resume={resume} generatedAt={generatedAt} /> : undefined,
  });

  useEffect(() => {
    if (!shouldAutoDownload || !resume || !instance.url || instance.loading) {
      return;
    }

    downloadResumePdf(instance.url);
    setShouldAutoDownload(false);
  }, [instance.loading, instance.url, resume, shouldAutoDownload]);

  const handleClick = useCallback(async () => {
    if (resume && instance.url && !instance.loading) {
      downloadResumePdf(instance.url);
      return;
    }

    setShouldAutoDownload(true);
    await ensureResumeData();
  }, [ensureResumeData, instance.loading, instance.url, resume]);

  const isLoading = isPreparing || (!!resume && instance.loading);

  return (
    <ShimmerButton
      onClick={handleClick}
      disabled={isLoading}
      background="rgba(5, 150, 105, 1)"
      shimmerColor="#34d399"
      borderRadius="8px"
      className="text-sm font-semibold px-6 py-2.5 shadow-lg shadow-emerald-500/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 focus-visible:ring-offset-2 focus-visible:ring-offset-zinc-950"
    >
      {isLoading ? (
        <Loader2 className="h-4 w-4 shrink-0 mr-2 animate-spin" />
      ) : (
        <Download className="h-4 w-4 shrink-0 mr-2" />
      )}
      {isLoading ? 'Gerando PDF...' : 'Baixar Currículo'}
    </ShimmerButton>
  );
}
