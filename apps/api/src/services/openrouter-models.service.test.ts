import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const { envMock, redisGetMock, redisSetMock, redisDelMock, fetchOpenRouterModelsMock } = vi.hoisted(
  () => ({
    envMock: {
      OPENROUTER_API_KEY: 'sk-test',
    },
    redisGetMock: vi.fn(),
    redisSetMock: vi.fn(),
    redisDelMock: vi.fn(),
    fetchOpenRouterModelsMock: vi.fn(),
  })
);

vi.mock('../config/env', () => ({ env: envMock }));

vi.mock('../config/redis', () => ({
  redis: {
    get: redisGetMock,
    set: redisSetMock,
    del: redisDelMock,
  },
}));

vi.mock('../lib/openrouter/models.client', () => ({
  fetchOpenRouterModels: fetchOpenRouterModelsMock,
}));

import {
  listEligibleModelsPaginated,
  loadEligibleModels,
  validateModelId,
} from './openrouter-models.service';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const ELIGIBLE_RAW = {
  id: 'openai/gpt-4o',
  name: 'GPT-4o',
  description: 'Flagship model',
  context_length: 128000,
  supported_parameters: ['structured_outputs'],
  expiration_date: null,
  architecture: {
    input_modalities: ['text'],
    output_modalities: ['text'],
    tokenizer: 'gpt',
    instruct_type: null,
  },
  pricing: { prompt: '0.000005', completion: '0.000015' },
  top_provider: { max_completion_tokens: 4096, is_moderated: false },
};

const INELIGIBLE_NO_STRUCTURED = {
  ...ELIGIBLE_RAW,
  id: 'legacy/gpt-3',
  name: 'Legacy GPT-3',
  supported_parameters: [], // no structured_outputs
};

const EXPIRED_MODEL = {
  ...ELIGIBLE_RAW,
  id: 'old/model',
  name: 'Old Model',
  expiration_date: '2020-01-01T00:00:00Z', // in the past
};

const ELIGIBLE_NORMALIZED = {
  id: 'openai/gpt-4o',
  providerFamily: 'openai',
  name: 'GPT-4o',
  description: 'Flagship model',
  contextLength: 128000,
  maxCompletionTokens: 4096,
  inputPrice: '0.000005',
  outputPrice: '0.000015',
  supportsStructuredOutputs: true,
  expirationDate: null,
  isDeprecated: false,
};

describe('openrouter-models.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.OPENROUTER_API_KEY = 'sk-test';
    redisGetMock.mockResolvedValue(null); // default: cache miss
    redisSetMock.mockResolvedValue('OK');
    redisDelMock.mockResolvedValue(1);
    fetchOpenRouterModelsMock.mockResolvedValue({
      data: [ELIGIBLE_RAW, INELIGIBLE_NO_STRUCTURED, EXPIRED_MODEL],
    });
  });

  // ── loadEligibleModels ──────────────────────────────────────────────────────

  describe('loadEligibleModels', () => {
    it('fetches from upstream on cache miss and filters eligible models', async () => {
      const result = await loadEligibleModels();

      expect(fetchOpenRouterModelsMock).toHaveBeenCalledOnce();
      expect(result.models).toHaveLength(1);
      expect(result.models[0]?.id).toBe('openai/gpt-4o');
      expect(result.fromCache).toBe(false);
    });

    it('returns cached data on cache hit without fetching upstream', async () => {
      redisGetMock.mockResolvedValue(JSON.stringify([ELIGIBLE_NORMALIZED]));

      const result = await loadEligibleModels();

      expect(fetchOpenRouterModelsMock).not.toHaveBeenCalled();
      expect(result.models).toHaveLength(1);
      expect(result.fromCache).toBe(true);
    });

    it('invalidates cache and refetches when forceRefresh=true', async () => {
      // beforeEach sets redisGetMock to return null (cache miss).
      // After forceRefresh, the del fires and readFromCache() returns null, triggering
      // a fresh upstream fetch. The mock should NOT simulate a post-del cache hit.
      const result = await loadEligibleModels(true);

      expect(redisDelMock).toHaveBeenCalledOnce();
      expect(fetchOpenRouterModelsMock).toHaveBeenCalledOnce();
      expect(result.fromCache).toBe(false);
    });

    it('excludes models without structured_outputs from eligible list', async () => {
      const result = await loadEligibleModels();

      const legacyModel = result.models.find((m) => m.id === 'legacy/gpt-3');
      expect(legacyModel).toBeUndefined();
    });

    it('excludes expired models from eligible list', async () => {
      const result = await loadEligibleModels();

      const expiredModel = result.models.find((m) => m.id === 'old/model');
      expect(expiredModel).toBeUndefined();
    });

    it('proceeds on Redis read failure (non-fatal cache miss)', async () => {
      redisGetMock.mockRejectedValue(new Error('redis down'));

      const result = await loadEligibleModels();

      expect(fetchOpenRouterModelsMock).toHaveBeenCalledOnce();
      expect(result.models).toHaveLength(1);
    });

    it('proceeds on Redis write failure (non-fatal)', async () => {
      redisSetMock.mockRejectedValue(new Error('redis down'));

      // Should NOT throw
      const result = await loadEligibleModels();
      expect(result.models).toHaveLength(1);
    });

    it('throws when upstream fetch fails and cache is empty', async () => {
      fetchOpenRouterModelsMock.mockRejectedValue(new Error('network error'));

      await expect(loadEligibleModels()).rejects.toThrow();
    });

    it('throws when OPENROUTER_API_KEY is missing', async () => {
      envMock.OPENROUTER_API_KEY = undefined as unknown as string;

      await expect(loadEligibleModels()).rejects.toThrow('OPENROUTER_API_KEY');
    });
  });

  // ── validateModelId ─────────────────────────────────────────────────────────

  describe('validateModelId', () => {
    it('returns true for a valid eligible model', async () => {
      const result = await validateModelId('openai/gpt-4o');
      expect(result).toBe(true);
    });

    it('returns false for a model not in the eligible list', async () => {
      const result = await validateModelId('unknown/model');
      expect(result).toBe(false);
    });

    it('throws when catalog fetch fails', async () => {
      fetchOpenRouterModelsMock.mockRejectedValue(new Error('upstream error'));

      await expect(validateModelId('openai/gpt-4o')).rejects.toThrow();
    });
  });

  // ── listEligibleModelsPaginated ─────────────────────────────────────────────

  describe('listEligibleModelsPaginated', () => {
    it('returns paginated list with correct meta', async () => {
      const result = await listEligibleModelsPaginated({
        page: 1,
        perPage: 20,
        forceRefresh: false,
      });

      expect(result.models).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.page).toBe(1);
      expect(result.meta.totalPages).toBe(1);
    });

    it('filters by search query (name/id/description)', async () => {
      fetchOpenRouterModelsMock.mockResolvedValue({
        data: [
          ELIGIBLE_RAW,
          {
            ...ELIGIBLE_RAW,
            id: 'anthropic/claude-3-haiku',
            name: 'Claude 3 Haiku',
            description: 'Fast and compact',
          },
        ],
      });

      const result = await listEligibleModelsPaginated({ page: 1, perPage: 20, q: 'claude' });

      expect(result.models).toHaveLength(1);
      expect(result.models[0]?.id).toBe('anthropic/claude-3-haiku');
    });

    it('returns empty list for query with no matches', async () => {
      const result = await listEligibleModelsPaginated({
        page: 1,
        perPage: 20,
        q: 'no-such-model',
      });

      expect(result.models).toHaveLength(0);
      expect(result.meta.total).toBe(0);
    });

    it('paginates correctly on second page', async () => {
      fetchOpenRouterModelsMock.mockResolvedValue({
        data: [
          ELIGIBLE_RAW,
          { ...ELIGIBLE_RAW, id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
        ],
      });

      const result = await listEligibleModelsPaginated({ page: 2, perPage: 1 });

      expect(result.models).toHaveLength(1);
      expect(result.meta.page).toBe(2);
      expect(result.meta.totalPages).toBe(2);
    });

    it('passes forceRefresh to loadEligibleModels', async () => {
      await listEligibleModelsPaginated({ page: 1, perPage: 20, forceRefresh: true });

      // forceRefresh=true triggers cache invalidation (del)
      expect(redisDelMock).toHaveBeenCalledOnce();
    });
  });
});
