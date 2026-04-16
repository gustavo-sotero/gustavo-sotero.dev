import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const {
  envMock,
  generateObjectMock,
  jsonSchemaMock,
  fakeModelFactory,
  NoObjectGeneratedErrorMock,
} = vi.hoisted(() => {
  // Minimal fake model factory that the OpenRouter provider would return.
  const fakeModelFactory = vi.fn((_modelId: string, _opts?: unknown) => ({
    modelId: 'fake-model',
  }));
  const jsonSchemaMock = vi.fn((schema: unknown, options?: unknown) => ({
    kind: 'json-schema',
    schema,
    options,
  }));

  // Minimal replica of the AI SDK's NoObjectGeneratedError with a static isInstance guard.
  class NoObjectGeneratedErrorMock extends Error {
    response: unknown;
    text: string;
    usage: { inputTokens: number; outputTokens: number };
    constructor(finishReason?: string) {
      super('No object generated');
      this.name = 'NoObjectGeneratedError';
      this.response = { finishReason };
      this.text = '';
      this.usage = { inputTokens: 10, outputTokens: 0 };
    }
    static isInstance(e: unknown): e is NoObjectGeneratedErrorMock {
      return e instanceof NoObjectGeneratedErrorMock;
    }
  }

  return {
    envMock: { AI_POSTS_TIMEOUT_MS: 5_000 },
    generateObjectMock: vi.fn(),
    jsonSchemaMock,
    fakeModelFactory,
    NoObjectGeneratedErrorMock,
  };
});

vi.mock('../../config/env', () => ({ env: envMock }));
vi.mock('../../config/logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));
vi.mock('./provider', () => ({
  getOpenRouterProvider: () => fakeModelFactory,
}));
vi.mock('ai', () => ({
  generateObject: (...args: unknown[]) => generateObjectMock(...args),
  jsonSchema: (schema: unknown, options?: unknown) => jsonSchemaMock(schema, options),
  NoObjectGeneratedError: NoObjectGeneratedErrorMock,
}));

import { AiGenerationError, generateStructuredObject } from './generateStructuredObject';

// ── Helpers ───────────────────────────────────────────────────────────────────

const RESULT_SCHEMA = z.object({ answer: z.string() });

const BASE_OPTS = {
  model: 'openai/gpt-4o',
  system: 'You are a helpful assistant.',
  prompt: 'What is 2+2?',
  schema: RESULT_SCHEMA,
  operation: 'test',
};

const MOCK_AI_RESULT = {
  object: { answer: '4' },
  usage: { inputTokens: 50, outputTokens: 10 },
};

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('generateStructuredObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.AI_POSTS_TIMEOUT_MS = 5_000;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('success path', () => {
    it('returns the object from the AI SDK response', async () => {
      generateObjectMock.mockResolvedValueOnce(MOCK_AI_RESULT);

      const result = await generateStructuredObject(BASE_OPTS);

      expect(result.object).toEqual({ answer: '4' });
    });

    it('returns inputTokens and outputTokens from usage', async () => {
      generateObjectMock.mockResolvedValueOnce(MOCK_AI_RESULT);

      const result = await generateStructuredObject(BASE_OPTS);

      expect(result.inputTokens).toBe(50);
      expect(result.outputTokens).toBe(10);
    });

    it('returns a non-negative durationMs', async () => {
      generateObjectMock.mockResolvedValueOnce(MOCK_AI_RESULT);

      const result = await generateStructuredObject(BASE_OPTS);

      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    });

    it('returns providerGenerationId from response.id when available', async () => {
      generateObjectMock.mockResolvedValueOnce({
        ...MOCK_AI_RESULT,
        response: { id: 'gen_response_id' },
      });

      const result = await generateStructuredObject(BASE_OPTS);

      expect(result.providerGenerationId).toBe('gen_response_id');
    });

    it('falls back to response.body.id when response.id is unavailable', async () => {
      generateObjectMock.mockResolvedValueOnce({
        ...MOCK_AI_RESULT,
        response: { body: { id: 'gen_body_id' } },
      });

      const result = await generateStructuredObject(BASE_OPTS);

      expect(result.providerGenerationId).toBe('gen_body_id');
    });

    it('passes require_parameters: true as a provider option', async () => {
      generateObjectMock.mockResolvedValueOnce(MOCK_AI_RESULT);

      await generateStructuredObject(BASE_OPTS);

      expect(fakeModelFactory).toHaveBeenCalledWith(
        'openai/gpt-4o',
        expect.objectContaining({ provider: { require_parameters: true } })
      );
    });

    it('passes explicit timeout and retry policy to the AI SDK call', async () => {
      generateObjectMock.mockResolvedValueOnce(MOCK_AI_RESULT);

      await generateStructuredObject({ ...BASE_OPTS, timeoutMs: 1_234, maxRetries: 2 });

      expect(generateObjectMock).toHaveBeenCalledWith(
        expect.objectContaining({ timeout: 1_234, maxRetries: 2 })
      );
    });

    it('sanitizes unsupported provider schema keywords but keeps Zod validation', async () => {
      const constrainedSchema = z.object({
        title: z.string().min(1).max(120),
        suggestions: z.array(z.string().min(1).max(20)).min(2).max(5),
      });

      generateObjectMock.mockResolvedValueOnce({
        object: { title: 'Valido', suggestions: ['um', 'dois'] },
        usage: { inputTokens: 50, outputTokens: 10 },
      });

      await generateStructuredObject({ ...BASE_OPTS, schema: constrainedSchema });

      const [providerSchema, options] = jsonSchemaMock.mock.calls[0] as [
        Record<string, unknown>,
        { validate: (value: unknown) => { success: boolean; value?: unknown; error?: Error } },
      ];
      const properties = providerSchema.properties as Record<string, Record<string, unknown>>;
      const title = properties.title;
      const suggestions = properties.suggestions as Record<string, unknown>;
      const suggestionItems = suggestions.items as Record<string, unknown>;

      expect(providerSchema.additionalProperties).toBe(false);
      expect(providerSchema.required).toEqual(['title', 'suggestions']);
      expect(title).not.toHaveProperty('minLength');
      expect(title).not.toHaveProperty('maxLength');
      expect(suggestions).not.toHaveProperty('minItems');
      expect(suggestions).not.toHaveProperty('maxItems');
      expect(suggestionItems).not.toHaveProperty('minLength');
      expect(suggestionItems).not.toHaveProperty('maxLength');

      expect(options.validate({ title: 'Valido', suggestions: ['um', 'dois'] })).toEqual({
        success: true,
        value: { title: 'Valido', suggestions: ['um', 'dois'] },
      });
      expect(options.validate({ title: '', suggestions: ['um'] })).toMatchObject({
        success: false,
      });
    });

    it('maps normalized provider routing to OpenRouter provider options', async () => {
      generateObjectMock.mockResolvedValueOnce(MOCK_AI_RESULT);

      await generateStructuredObject({
        ...BASE_OPTS,
        providerRouting: {
          mode: 'manual',
          allowFallbacks: false,
          providerOrder: ['anthropic', 'openai'],
          onlyProviders: ['anthropic'],
          ignoreProviders: ['together'],
          sort: 'latency',
          preferredMaxLatencySeconds: 10,
          preferredMinThroughput: 100,
        },
      });

      expect(fakeModelFactory).toHaveBeenCalledWith(
        'openai/gpt-4o',
        expect.objectContaining({
          provider: {
            require_parameters: true,
            order: ['anthropic', 'openai'],
            allow_fallbacks: false,
            sort: 'latency',
            preferred_max_latency: 10,
            preferred_min_throughput: 100,
            only: ['anthropic'],
            ignore: ['together'],
          },
        })
      );
    });

    it('passes the provided model ID to the model factory', async () => {
      generateObjectMock.mockResolvedValueOnce(MOCK_AI_RESULT);

      await generateStructuredObject({ ...BASE_OPTS, model: 'anthropic/claude-3-haiku' });

      expect(fakeModelFactory).toHaveBeenCalledWith('anthropic/claude-3-haiku', expect.anything());
    });
  });

  describe('timeout path', () => {
    it('throws AiGenerationError with kind=timeout when abort fires before response', async () => {
      vi.useFakeTimers();
      envMock.AI_POSTS_TIMEOUT_MS = 200;

      // The mock listens for the abort event and rejects, simulating a real provider
      // that respects the abort signal.
      generateObjectMock.mockImplementation(
        ({ abortSignal }: { abortSignal?: AbortSignal }) =>
          new Promise<never>((_, reject) => {
            const handler = () => {
              abortSignal?.removeEventListener('abort', handler);
              reject(new Error('Aborted by signal'));
            };
            abortSignal?.addEventListener('abort', handler);
          })
      );

      const promise = generateStructuredObject(BASE_OPTS);
      // Attach the rejection handler BEFORE advancing timers so the rejection is
      // never "unhandled" from vitest's perspective when the abort fires.
      const caughtPromise = promise.catch((e) => e as unknown);

      // Advance past the configured timeout to fire the AbortController.
      await vi.advanceTimersByTimeAsync(201);

      const caught = await caughtPromise;
      expect(caught).toMatchObject({ kind: 'timeout' });
    });
  });

  describe('refusal path', () => {
    it('throws AiGenerationError with kind=refusal when finishReason is content-filter', async () => {
      generateObjectMock.mockRejectedValueOnce(new NoObjectGeneratedErrorMock('content-filter'));

      await expect(generateStructuredObject(BASE_OPTS)).rejects.toMatchObject({
        kind: 'refusal',
      });
    });
  });

  describe('validation path', () => {
    it('throws AiGenerationError with kind=validation when no object is generated without refusal', async () => {
      generateObjectMock.mockRejectedValueOnce(new NoObjectGeneratedErrorMock('stop'));

      await expect(generateStructuredObject(BASE_OPTS)).rejects.toMatchObject({
        kind: 'validation',
      });
    });

    it('throws AiGenerationError with kind=validation when finishReason is unknown', async () => {
      generateObjectMock.mockRejectedValueOnce(new NoObjectGeneratedErrorMock(undefined));

      await expect(generateStructuredObject(BASE_OPTS)).rejects.toMatchObject({
        kind: 'validation',
      });
    });
  });

  describe('provider error path', () => {
    it('throws AiGenerationError with kind=provider on unexpected provider error', async () => {
      generateObjectMock.mockRejectedValueOnce(new Error('Unexpected provider failure'));

      await expect(generateStructuredObject(BASE_OPTS)).rejects.toMatchObject({
        kind: 'provider',
      });
    });
  });

  describe('AiGenerationError', () => {
    it('has the correct name property', () => {
      const err = new AiGenerationError('timeout', 'timed out');

      expect(err.name).toBe('AiGenerationError');
      expect(err.kind).toBe('timeout');
      expect(err.message).toBe('timed out');
    });

    it('is an instance of Error', () => {
      expect(new AiGenerationError('provider', 'test')).toBeInstanceOf(Error);
    });
  });
});
