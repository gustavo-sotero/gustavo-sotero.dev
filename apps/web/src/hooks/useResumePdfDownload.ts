'use client';

import { type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { RESUME_PDF_FILENAME, RESUME_PDF_PATH } from '@/lib/resume/pdf';

let pendingResumePdfUrlPromise: Promise<string> | null = null;

function downloadResumePdf(url: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = RESUME_PDF_FILENAME;
  anchor.click();
}

async function getResumePdfUrl(): Promise<string> {
  if (pendingResumePdfUrlPromise) {
    return pendingResumePdfUrlPromise;
  }

  pendingResumePdfUrlPromise = fetch(RESUME_PDF_PATH)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Resume PDF request failed with status ${response.status}`);
      }

      const blob = await response.blob();
      return URL.createObjectURL(blob);
    })
    .finally(() => {
      pendingResumePdfUrlPromise = null;
    });

  return pendingResumePdfUrlPromise;
}

export function clearResumePdfDownloadCache() {
  pendingResumePdfUrlPromise = null;
}

export function useResumePdfDownload() {
  const [isPreparing, setIsPreparing] = useState(false);
  const [pendingDownloadUrl, setPendingDownloadUrl] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const latestDownloadUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;

      if (!latestDownloadUrlRef.current) {
        return;
      }

      URL.revokeObjectURL(latestDownloadUrlRef.current);
      latestDownloadUrlRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!pendingDownloadUrl) {
      return;
    }

    if (latestDownloadUrlRef.current && latestDownloadUrlRef.current !== pendingDownloadUrl) {
      URL.revokeObjectURL(latestDownloadUrlRef.current);
    }

    latestDownloadUrlRef.current = pendingDownloadUrl;

    downloadResumePdf(pendingDownloadUrl);
    setPendingDownloadUrl(null);
  }, [pendingDownloadUrl]);

  const handleClick = useCallback(
    async (event: MouseEvent<HTMLAnchorElement>) => {
      if (event.defaultPrevented) {
        return;
      }

      if (isPreparing) {
        event.preventDefault();
        return;
      }

      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      event.preventDefault();

      setIsPreparing(true);

      try {
        const url = await getResumePdfUrl();

        if (isMountedRef.current) {
          setPendingDownloadUrl(url);
        }
      } catch {
      } finally {
        if (isMountedRef.current) {
          setIsPreparing(false);
        }
      }
    },
    [isPreparing]
  );

  return { isPreparing, handleClick };
}
