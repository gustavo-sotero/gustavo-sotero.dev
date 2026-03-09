import type { Upload } from '@portfolio/shared';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export function getUploadErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (
    isRecord(error) &&
    isRecord(error.error) &&
    typeof error.error.message === 'string' &&
    error.error.message.length > 0
  ) {
    return error.error.message;
  }

  return 'Erro desconhecido no upload';
}

export function resolveUploadEffectiveUrl(upload: Upload): string {
  return upload.optimizedUrl ?? upload.variants?.medium ?? upload.originalUrl;
}
