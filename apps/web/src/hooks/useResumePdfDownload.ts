'use client';

import { type MouseEvent, useCallback, useEffect, useRef, useState } from 'react';
import { RESUME_PDF_FILENAME, RESUME_PDF_PATH } from '@/lib/resume/pdf';

let cachedResumePdfUrl: string | null = null;
let pendingResumePdfUrlPromise: Promise<string> | null = null;
let pageHideCleanup: (() => void) | null = null;

function revokeCachedResumePdfUrl() {
  if (!cachedResumePdfUrl) {
    return;
  }

  URL.revokeObjectURL(cachedResumePdfUrl);
  cachedResumePdfUrl = null;
}

function clearPageHideCleanup() {
  if (!pageHideCleanup || typeof window === 'undefined') {
    return;
  }

  window.removeEventListener('pagehide', pageHideCleanup);
  pageHideCleanup = null;
}

function ensurePageHideCleanup() {
  if (pageHideCleanup || typeof window === 'undefined') {
    return;
  }

  pageHideCleanup = () => {
    revokeCachedResumePdfUrl();
    clearPageHideCleanup();
  };

  window.addEventListener('pagehide', pageHideCleanup, { once: true });
}

function downloadResumePdf(url: string) {
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = RESUME_PDF_FILENAME;
  anchor.click();
}

async function getResumePdfUrl(): Promise<string> {
  if (cachedResumePdfUrl) {
    return cachedResumePdfUrl;
  }

  if (pendingResumePdfUrlPromise) {
    return pendingResumePdfUrlPromise;
  }

  pendingResumePdfUrlPromise = fetch(RESUME_PDF_PATH)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Resume PDF request failed with status ${response.status}`);
      }

      const blob = await response.blob();
      const url = URL.createObjectURL(blob);

      cachedResumePdfUrl = url;
      ensurePageHideCleanup();

      return url;
    })
    .finally(() => {
      pendingResumePdfUrlPromise = null;
    });

  return pendingResumePdfUrlPromise;
}

export function clearResumePdfDownloadCache() {
  pendingResumePdfUrlPromise = null;
  revokeCachedResumePdfUrl();
  clearPageHideCleanup();
}

export function useResumePdfDownload() {
  const [isPreparing, setIsPreparing] = useState(false);
  const [pendingDownloadUrl, setPendingDownloadUrl] = useState<string | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!pendingDownloadUrl) {
      return;
    }

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

      if (cachedResumePdfUrl) {
        setPendingDownloadUrl(cachedResumePdfUrl);
        return;
      }

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
