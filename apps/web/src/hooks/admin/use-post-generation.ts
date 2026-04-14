'use client';

import type {
  GenerateDraftRequest,
  GenerateDraftResponse,
  GenerateTopicsRequest,
  GenerateTopicsResponse,
} from '@portfolio/shared';
import { useMutation } from '@tanstack/react-query';
import { apiPost } from '@/lib/api';

/**
 * Mutation hook to generate topic suggestions from the AI assistant.
 *
 * Calls POST /admin/posts/generate/topics — admin-only, CSRF required.
 * Returns { suggestions: TopicSuggestion[] } on success.
 */
export function useGeneratePostTopics() {
  return useMutation<GenerateTopicsResponse, unknown, GenerateTopicsRequest>({
    mutationFn: async (data) => {
      const res = await apiPost<GenerateTopicsResponse>('/admin/posts/generate/topics', data);
      if (!res?.data) throw new Error('Empty response from topics endpoint');
      return res.data;
    },
  });
}

/**
 * Mutation hook to generate a complete post draft from an approved suggestion.
 *
 * Calls POST /admin/posts/generate/draft — admin-only, CSRF required.
 * Returns the full structured draft payload on success.
 */
export function useGeneratePostDraft() {
  return useMutation<GenerateDraftResponse, unknown, GenerateDraftRequest>({
    mutationFn: async (data) => {
      const res = await apiPost<GenerateDraftResponse>('/admin/posts/generate/draft', data);
      if (!res?.data) throw new Error('Empty response from draft endpoint');
      return res.data;
    },
  });
}
