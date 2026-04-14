import type { AiPostGenerationModelSummary, AiPostGenerationModelsQuery } from '@portfolio/shared';
import type { PaginationMeta } from '@portfolio/shared/types/api';
import { env } from '../config/env';
import { getLogger } from '../config/logger';
import { redis } from '../config/redis';
import { fetchOpenRouterModels } from '../lib/openrouter/models.client';
import type { OpenRouterRawModel } from '../lib/openrouter/models.schema';

const logger = getLogger('services', 'openrouter-models');

const CACHE_KEY = 'ai-post-generation:openrouter-models:v1';
const CACHE_TTL_SECONDS = 300; // 5 minutes

// ── Normalization ─────────────────────────────────────────────────────────────

function deriveProviderFamily(modelId: string): string {
  return modelId.split('/')[0] ?? modelId;
}

function isTextCapable(model: OpenRouterRawModel): boolean {
  const arch = model.architecture;
  if (!arch) return true; // Assume text-capable when info is absent

  const inputs = arch.input_modalities ?? [];
  const outputs = arch.output_modalities ?? [];

  // Must accept text input and produce text output
  if (inputs.length > 0 && !inputs.includes('text')) return false;
  if (outputs.length > 0 && !outputs.includes('text')) return false;

  return true;
}

function isExpired(model: OpenRouterRawModel): boolean {
  if (!model.expiration_date) return false;
  try {
    return new Date(model.expiration_date) < new Date();
  } catch {
    return false;
  }
}

function supportsStructuredOutputs(model: OpenRouterRawModel): boolean {
  return (model.supported_parameters ?? []).includes('structured_outputs');
}

function normalizeModel(model: OpenRouterRawModel): AiPostGenerationModelSummary {
  return {
    id: model.id,
    providerFamily: deriveProviderFamily(model.id),
    name: model.name || model.id,
    description: model.description ?? '',
    contextLength: model.context_length ?? null,
    maxCompletionTokens: model.top_provider?.max_completion_tokens ?? null,
    inputPrice: model.pricing?.prompt ?? null,
    outputPrice: model.pricing?.completion ?? null,
    supportsStructuredOutputs: supportsStructuredOutputs(model),
    expirationDate: model.expiration_date ?? null,
    isDeprecated: isExpired(model),
  };
}

/**
 * Models eligible for structured post generation:
 * - text input + text output
 * - supports structured_outputs
 * - not expired
 */
function isEligible(model: OpenRouterRawModel): boolean {
  return isTextCapable(model) && supportsStructuredOutputs(model) && !isExpired(model);
}

// ── Cache helpers ─────────────────────────────────────────────────────────────

async function readFromCache(): Promise<AiPostGenerationModelSummary[] | null> {
  try {
    const raw = await redis.get(CACHE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AiPostGenerationModelSummary[];
  } catch (err) {
    logger.warn('OpenRouter models cache read failed', {
      error: (err as Error).message,
      cached: false,
    });
    return null;
  }
}

async function writeToCache(models: AiPostGenerationModelSummary[]): Promise<void> {
  try {
    await redis.set(CACHE_KEY, JSON.stringify(models), 'EX', CACHE_TTL_SECONDS);
  } catch (err) {
    logger.warn('OpenRouter models cache write failed', {
      error: (err as Error).message,
    });
    // Non-fatal — continue without cache
  }
}

async function invalidateCache(): Promise<void> {
  try {
    await redis.del(CACHE_KEY);
  } catch {
    // Best-effort
  }
}

// ── Catalog loading ───────────────────────────────────────────────────────────

/**
 * Load the eligible model list from cache or upstream.
 *
 * If `forceRefresh` is true, the cache is invalidated before fetching.
 * Redis failures are treated as cache misses — the upstream is always tried.
 *
 * Throws if the upstream fetch fails and there is no cached fallback.
 */
export async function loadEligibleModels(forceRefresh = false): Promise<{
  models: AiPostGenerationModelSummary[];
  fetchedAt: string;
  fromCache: boolean;
}> {
  if (forceRefresh) {
    await invalidateCache();
  }

  const cached = await readFromCache();
  if (cached) {
    logger.debug('OpenRouter models catalog cache hit', { cached: true });
    return {
      models: cached,
      fetchedAt: new Date().toISOString(),
      fromCache: true,
    };
  }

  logger.debug('OpenRouter models catalog cache miss — fetching from upstream', { cached: false });

  if (!env.OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY is not set — cannot fetch OpenRouter catalog');
  }

  const response = await fetchOpenRouterModels(env.OPENROUTER_API_KEY);
  const eligible = response.data.filter(isEligible).map(normalizeModel);

  await writeToCache(eligible);

  return {
    models: eligible,
    fetchedAt: new Date().toISOString(),
    fromCache: false,
  };
}

/**
 * Check whether a specific model ID exists in the eligible catalog and
 * supports structured outputs.
 *
 * Returns `true` when the model is found and valid, `false` when not found.
 * If the catalog cannot be loaded, throws to signal `catalog-unavailable`.
 */
export async function validateModelId(modelId: string): Promise<boolean> {
  const { models } = await loadEligibleModels();
  return models.some((m) => m.id === modelId && m.supportsStructuredOutputs);
}

// ── Paginated search ──────────────────────────────────────────────────────────

function matchesQuery(model: AiPostGenerationModelSummary, q: string): boolean {
  const needle = q.toLowerCase();
  return (
    model.id.toLowerCase().includes(needle) ||
    model.name.toLowerCase().includes(needle) ||
    model.description.toLowerCase().includes(needle)
  );
}

export interface PaginatedModelsResult {
  models: AiPostGenerationModelSummary[];
  meta: PaginationMeta;
  fetchedAt: string;
  fromCache: boolean;
}

export async function listEligibleModelsPaginated(
  query: AiPostGenerationModelsQuery
): Promise<PaginatedModelsResult> {
  const { page, perPage, q, forceRefresh } = query;

  const { models: all, fetchedAt, fromCache } = await loadEligibleModels(forceRefresh ?? false);

  const filtered = q ? all.filter((m) => matchesQuery(m, q)) : all;

  // Sort by provider family then name for consistent ordering
  const sorted = filtered.slice().sort((a, b) => {
    const fam = a.providerFamily.localeCompare(b.providerFamily);
    if (fam !== 0) return fam;
    return a.name.localeCompare(b.name);
  });

  const total = sorted.length;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const offset = (page - 1) * perPage;
  const pageItems = sorted.slice(offset, offset + perPage);

  return {
    models: pageItems,
    meta: { page, perPage, total, totalPages },
    fetchedAt,
    fromCache,
  };
}
