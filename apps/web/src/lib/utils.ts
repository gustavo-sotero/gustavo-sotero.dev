import type { Tag } from '@portfolio/shared/types/tags';
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PivotTag {
  postId?: number;
  projectId?: number;
  tagId: number;
  tag: Tag;
}

/** Flatten pivot tags (from listings/detail) to a flat array of tags. */
export function flattenTags(pivotTags?: PivotTag[] | null): Tag[] {
  if (!pivotTags) return [];
  return pivotTags.map((pt) => pt.tag);
}

/** Format a date string to Brazilian Portuguese locale */
export function formatDateBR(date: string | Date | null | undefined): string {
  if (!date) return '';
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(date));
}
