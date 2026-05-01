'use client';

import type {
  AiPostGenerationConfigState,
  AiPostGenerationModelSummary,
  UpdateAiPostGenerationConfig,
} from '@portfolio/shared/schemas/ai-post-generation-config';
import type { PaginatedResponse } from '@portfolio/shared/types/api';
import { useQuery } from '@tanstack/react-query';
import { apiGet, apiGetPaginated, apiPut } from '@/lib/api';
import { useAdminMutation } from './mutation';
import { adminKeys } from './query-keys';

/**
 * Query hook for the current AI post generation config state.
 *
 * Calls GET /admin/posts/generate/config — admin-only.
 * Returns the full `AiPostGenerationConfigState` including status,
 * active model IDs, and any validation issues.
 */
export function useAiPostGenerationConfig() {
  return useQuery<AiPostGenerationConfigState>({
    queryKey: adminKeys.aiPostGenerationConfig(),
    queryFn: () =>
      apiGet<AiPostGenerationConfigState>('/admin/posts/generate/config').then(
        (r) => r?.data as AiPostGenerationConfigState
      ),
  });
}

export interface AiPostGenerationModelsParams {
  page?: number;
  perPage?: number;
  q?: string;
  forceRefresh?: boolean;
}

export function buildAiPostGenerationModelsPath(params?: AiPostGenerationModelsParams): string {
  const { page = 1, perPage = 20, q, forceRefresh } = params ?? {};

  const searchParams = new URLSearchParams();
  searchParams.set('page', String(page));
  searchParams.set('perPage', String(perPage));
  if (q) searchParams.set('q', q);
  if (forceRefresh) searchParams.set('forceRefresh', 'true');

  return `/admin/posts/generate/models?${searchParams.toString()}`;
}

export function getAiPostGenerationModels(params?: AiPostGenerationModelsParams) {
  return apiGetPaginated<AiPostGenerationModelSummary>(buildAiPostGenerationModelsPath(params));
}

/**
 * Query hook for the paginated, searchable list of eligible OpenRouter models.
 *
 * Calls GET /admin/posts/generate/models — admin-only.
 * Supports search (`q`), pagination, and force-refresh of the catalog cache.
 */
export function useAiPostGenerationModels(params?: AiPostGenerationModelsParams) {
  return useQuery<PaginatedResponse<AiPostGenerationModelSummary>>({
    queryKey: adminKeys.aiPostGenerationModels(params),
    queryFn: () => getAiPostGenerationModels(params),
  });
}

/**
 * Mutation hook to save the active AI post generation model pair.
 *
 * Calls PUT /admin/posts/generate/config — admin-only, CSRF required.
 * Invalidates the config state query on success.
 */
export function useUpdateAiPostGenerationConfig() {
  return useAdminMutation({
    mutationFn: (data: UpdateAiPostGenerationConfig) =>
      apiPut<AiPostGenerationConfigState>('/admin/posts/generate/config', data),
    invalidate: [adminKeys.aiPostGenerationConfig()],
    successToast: 'Configuração de modelos salva com sucesso!',
    errorToast: 'Erro ao salvar configuração de modelos.',
  });
}
