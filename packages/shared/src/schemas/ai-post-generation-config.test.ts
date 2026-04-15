import { describe, expect, it } from 'vitest';
import {
  aiPostGenerationConfigSchema,
  aiPostGenerationConfigStateSchema,
  aiPostGenerationModelSummarySchema,
  aiPostGenerationModelsQuerySchema,
  aiPostGenerationStatusSchema,
  providerRoutingConfigSchema,
  updateAiPostGenerationConfigSchema,
} from './ai-post-generation-config';

describe('ai-post-generation-config schemas', () => {
  describe('aiPostGenerationStatusSchema', () => {
    it('accepts every supported status value', () => {
      expect(aiPostGenerationStatusSchema.safeParse('disabled').success).toBe(true);
      expect(aiPostGenerationStatusSchema.safeParse('not-configured').success).toBe(true);
      expect(aiPostGenerationStatusSchema.safeParse('ready').success).toBe(true);
      expect(aiPostGenerationStatusSchema.safeParse('invalid-config').success).toBe(true);
      expect(aiPostGenerationStatusSchema.safeParse('catalog-unavailable').success).toBe(true);
    });

    it('rejects unsupported status values', () => {
      expect(aiPostGenerationStatusSchema.safeParse('partial').success).toBe(false);
    });
  });

  describe('aiPostGenerationConfigSchema', () => {
    it('accepts a valid persisted config', () => {
      const result = aiPostGenerationConfigSchema.safeParse({
        topicsModelId: 'anthropic/claude-sonnet-4-5',
        draftModelId: 'openai/gpt-4o',
      });

      expect(result.success).toBe(true);
    });

    it('rejects empty model ids', () => {
      const result = aiPostGenerationConfigSchema.safeParse({
        topicsModelId: '',
        draftModelId: 'openai/gpt-4o',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('aiPostGenerationConfigStateSchema', () => {
    it('accepts a ready config state', () => {
      const result = aiPostGenerationConfigStateSchema.safeParse({
        featureEnabled: true,
        status: 'ready',
        config: {
          topicsModelId: 'anthropic/claude-sonnet-4-5',
          draftModelId: 'openai/gpt-4o',
        },
        issues: [],
        updatedAt: '2026-04-14T12:00:00.000Z',
        updatedBy: '12345678',
        catalogFetchedAt: '2026-04-14T12:00:00.000Z',
      });

      expect(result.success).toBe(true);
    });

    it('rejects invalid datetime strings', () => {
      const result = aiPostGenerationConfigStateSchema.safeParse({
        featureEnabled: true,
        status: 'catalog-unavailable',
        config: {
          topicsModelId: 'anthropic/claude-sonnet-4-5',
          draftModelId: 'openai/gpt-4o',
        },
        issues: ['Catálogo indisponível.'],
        updatedAt: '14/04/2026 12:00',
        updatedBy: '12345678',
        catalogFetchedAt: null,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('updateAiPostGenerationConfigSchema', () => {
    it('requires both selected model ids', () => {
      const result = updateAiPostGenerationConfigSchema.safeParse({
        topicsModelId: 'anthropic/claude-sonnet-4-5',
        draftModelId: 'openai/gpt-4o',
      });

      expect(result.success).toBe(true);
    });

    it('rejects blank draft model id', () => {
      const result = updateAiPostGenerationConfigSchema.safeParse({
        topicsModelId: 'anthropic/claude-sonnet-4-5',
        draftModelId: '',
      });

      expect(result.success).toBe(false);
    });
  });

  describe('aiPostGenerationModelSummarySchema', () => {
    it('accepts a normalized eligible model summary', () => {
      const result = aiPostGenerationModelSummarySchema.safeParse({
        id: 'openai/gpt-4o',
        providerFamily: 'openai',
        name: 'GPT-4o',
        description: 'Modelo multimodal com boa aderência a JSON schema.',
        contextLength: 128000,
        maxCompletionTokens: 16384,
        inputPrice: '0.0000025',
        outputPrice: '0.00001',
        supportsStructuredOutputs: true,
        expirationDate: null,
        isDeprecated: false,
      });

      expect(result.success).toBe(true);
    });

    it('defaults description to an empty string when omitted', () => {
      const result = aiPostGenerationModelSummarySchema.parse({
        id: 'openai/gpt-4o',
        providerFamily: 'openai',
        name: 'GPT-4o',
        contextLength: null,
        maxCompletionTokens: null,
        inputPrice: null,
        outputPrice: null,
        supportsStructuredOutputs: true,
        expirationDate: null,
        isDeprecated: false,
      });

      expect(result.description).toBe('');
    });

    it('rejects invalid expirationDate values', () => {
      const result = aiPostGenerationModelSummarySchema.safeParse({
        id: 'openai/gpt-4o',
        providerFamily: 'openai',
        name: 'GPT-4o',
        description: '',
        contextLength: 128000,
        maxCompletionTokens: 16384,
        inputPrice: '0.0000025',
        outputPrice: '0.00001',
        supportsStructuredOutputs: true,
        expirationDate: 'amanha',
        isDeprecated: false,
      });

      expect(result.success).toBe(false);
    });
  });

  describe('aiPostGenerationModelsQuerySchema', () => {
    it('applies pagination defaults and coerces booleans', () => {
      const result = aiPostGenerationModelsQuerySchema.parse({
        forceRefresh: 'true',
      });

      expect(result).toEqual({
        page: 1,
        perPage: 20,
        forceRefresh: true,
      });
    });

    it('trims search input and rejects perPage above 100', () => {
      const parsed = aiPostGenerationModelsQuerySchema.safeParse({
        q: '  claude  ',
        perPage: 101,
      });

      expect(parsed.success).toBe(false);

      const valid = aiPostGenerationModelsQuerySchema.parse({
        q: '  claude  ',
        perPage: 8,
      });

      expect(valid.q).toBe('claude');
    });
  });

  describe('providerRoutingConfigSchema', () => {
    it('accepts null (no routing preferences)', () => {
      expect(providerRoutingConfigSchema.safeParse(null).success).toBe(true);
    });

    it('accepts an empty object (all fields optional)', () => {
      expect(providerRoutingConfigSchema.safeParse({}).success).toBe(true);
    });

    it('accepts a fully populated routing config', () => {
      const result = providerRoutingConfigSchema.safeParse({
        order: ['openai', 'anthropic'],
        allow_fallbacks: true,
        sort: 'latency',
        preferred_max_latency: 5000,
        preferred_min_throughput: 100,
      });

      expect(result.success).toBe(true);
    });

    it('accepts partial routing config with only order and allow_fallbacks', () => {
      const result = providerRoutingConfigSchema.safeParse({
        order: ['openai'],
        allow_fallbacks: false,
      });

      expect(result.success).toBe(true);
    });

    it('rejects negative preferred_max_latency', () => {
      const result = providerRoutingConfigSchema.safeParse({
        preferred_max_latency: -1,
      });

      expect(result.success).toBe(false);
    });

    it('rejects zero preferred_min_throughput', () => {
      const result = providerRoutingConfigSchema.safeParse({
        preferred_min_throughput: 0,
      });

      expect(result.success).toBe(false);
    });

    it('rejects non-integer preferred_max_latency', () => {
      const result = providerRoutingConfigSchema.safeParse({
        preferred_max_latency: 1.5,
      });

      expect(result.success).toBe(false);
    });

    it('config schema accepts topicsRouting and draftRouting', () => {
      const result = aiPostGenerationConfigSchema.safeParse({
        topicsModelId: 'openai/gpt-4o',
        draftModelId: 'anthropic/claude-sonnet-4-5',
        topicsRouting: { order: ['openai'], allow_fallbacks: true },
        draftRouting: null,
      });

      expect(result.success).toBe(true);
    });
  });
});
