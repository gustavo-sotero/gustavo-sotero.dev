import 'server-only';

import { createHash } from 'node:crypto';
import type { ResumeViewModel } from '@/lib/resume/mapper';
import { RESUME_PDF_TEMPLATE_VERSION } from './pdf';

export function createResumePdfEtag(resume: ResumeViewModel, generatedAt: string): string {
  const versionPayload = JSON.stringify({
    templateVersion: RESUME_PDF_TEMPLATE_VERSION,
    generatedAt,
    resume,
  });
  const hash = createHash('sha256').update(versionPayload).digest('base64url');

  return `"resume-pdf-${hash}"`;
}

export function requestMatchesEtag(ifNoneMatch: string | null, etag: string): boolean {
  if (!ifNoneMatch) {
    return false;
  }

  if (ifNoneMatch.trim() === '*') {
    return true;
  }

  return ifNoneMatch
    .split(',')
    .map((tag) => tag.trim())
    .some((tag) => tag === etag || tag === `W/${etag}`);
}
