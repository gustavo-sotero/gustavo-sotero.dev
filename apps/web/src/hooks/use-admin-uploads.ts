'use client';

import type { PresignRequest, PresignResponse, Upload } from '@portfolio/shared';
import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { getUploadErrorMessage, resolveUploadEffectiveUrl } from './upload-helpers';

export type UploadStage =
  | 'idle'
  | 'presigning'
  | 'uploading'
  | 'confirming'
  | 'processing'
  | 'done'
  | 'error';

export interface UploadState {
  stage: UploadStage;
  progress: number; // 0–100
  uploadId?: string;
  originalUrl?: string;
  effectiveUrl?: string;
  optimizedUrl?: string | null;
  variants?: { thumbnail?: string; medium?: string } | null;
  error?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUploadLike(value: unknown): value is Upload {
  return (
    isRecord(value) &&
    typeof value.id === 'string' &&
    typeof value.originalUrl === 'string' &&
    typeof value.mime === 'string' &&
    typeof value.size === 'number' &&
    typeof value.status === 'string'
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Poll for upload completion by calling the provided fetch function on each attempt.
 *
 * Uses exponential backoff (starting at `initialDelayMs`, doubling each attempt,
 * capped at `maxDelayMs`) to reduce burst pressure on the API during processing.
 *
 * Exported for unit testing — production usage goes through `useAdminUpload`.
 *
 * @throws Error with `code: 'PROCESSING_FAILED'` when status is `failed`
 * @throws Error with `code: 'PROCESSING_TIMEOUT'` when max attempts exceeded
 */
export async function pollUntilProcessed(
  uploadId: string,
  fetchFn: (uploadId: string) => Promise<{ data: Upload }>,
  maxAttempts = 15,
  initialDelayMs = 1000,
  maxDelayMs = 10_000
): Promise<Upload> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const res = await fetchFn(uploadId);
    const { status } = res.data;

    if (status === 'processed') return res.data;

    if (status === 'failed') {
      throw Object.assign(
        new Error('Otimização da imagem falhou. Tente fazer o upload novamente.'),
        { code: 'PROCESSING_FAILED' }
      );
    }

    // Still `uploaded` (or any other non-terminal status) — back off and retry
    if (attempt < maxAttempts - 1) {
      const delay = Math.min(initialDelayMs * 2 ** attempt, maxDelayMs);
      await sleep(delay);
    }
  }

  throw Object.assign(
    new Error('Tempo limite de processamento excedido. Tente reenviar a imagem.'),
    { code: 'PROCESSING_TIMEOUT' }
  );
}

async function putToS3(
  presignedUrl: string,
  file: File,
  onProgress: (pct: number) => void
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', presignedUrl);
    xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.addEventListener('progress', (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve();
      } else {
        reject(new Error(`S3 upload failed: ${xhr.status}`));
      }
    });

    xhr.addEventListener('error', () => reject(new Error('S3 upload network error')));
    xhr.send(file);
  });
}

export function useAdminUpload() {
  const [state, setState] = useState<UploadState>({ stage: 'idle', progress: 0 });

  const upload = useCallback(async (file: File): Promise<Upload | null> => {
    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
    if (!allowedMimes.includes(file.type as (typeof allowedMimes)[number])) {
      toast.error('Tipo de arquivo não permitido. Use JPG, PNG, WebP ou GIF.');
      return null;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Arquivo muito grande. Máximo de 5MB.');
      return null;
    }
    try {
      setState({ stage: 'presigning', progress: 0 });
      const presignReq: PresignRequest = {
        mime: file.type as PresignRequest['mime'],
        size: file.size,
        filename: file.name,
      };
      const presignRes = await apiFetch<PresignResponse>('/admin/uploads/presign', {
        method: 'POST',
        body: JSON.stringify(presignReq),
      });
      const { presignedUrl, uploadId } = presignRes?.data as PresignResponse;

      setState({ stage: 'uploading', progress: 0 });
      await putToS3(presignedUrl, file, (pct) => {
        setState((prev) => ({ ...prev, progress: pct }));
      });

      setState((prev) => ({ ...prev, stage: 'confirming', progress: 100 }));
      const confirmRes = await apiFetch<Upload>(`/admin/uploads/${uploadId}/confirm`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const confirmed = confirmRes?.data;

      if (!isUploadLike(confirmed)) {
        throw new Error('Resposta de confirmação inválida. Tente reenviar a imagem.');
      }

      // The confirm endpoint returns status='uploaded' — the image-optimize job
      // runs asynchronously. Poll until the worker finishes (processed/failed).
      setState((prev) => ({ ...prev, stage: 'processing' }));
      const processed = await pollUntilProcessed(
        uploadId,
        (id) => apiFetch<Upload>(`/admin/uploads/${id}`) as Promise<{ data: Upload }>
      );

      const effectiveUrl = resolveUploadEffectiveUrl(processed);

      setState({
        stage: 'done',
        progress: 100,
        uploadId: processed.id,
        originalUrl: processed.originalUrl,
        effectiveUrl,
        optimizedUrl: processed.optimizedUrl,
        variants: processed.variants,
      });
      return processed;
    } catch (err) {
      const message = getUploadErrorMessage(err);
      setState({ stage: 'error', progress: 0, error: message });
      toast.error(`Upload falhou: ${message}`);
      return null;
    }
  }, []);

  const reset = useCallback(() => setState({ stage: 'idle', progress: 0 }), []);

  return { state, upload, reset };
}

/** @deprecated Use useAdminUpload instead */
export interface UploadedFile {
  uploadId: string;
  key: string;
  originalUrl: string;
  optimizedUrl?: string | null;
  variants?: { thumbnail?: string; medium?: string } | null;
  mime: string;
  size: number;
  width?: number | null;
  height?: number | null;
}
