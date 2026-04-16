import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { z } from 'zod';

const {
  envMock,
  generateObjectMock,
  jsonSchemaMock,
  fakeModelFactory,
  NoObjectGeneratedErrorMock,
} = vi.hoisted(() => {
  const fakeModelFactory = vi.fn((_modelId: string, _opts?: unknown) => ({
    modelId: 'fake-model',
  }));
  const jsonSchemaMock = vi.fn((schema: unknown, options?: unknown) => ({
    kind: 'json-schema',
    schema,
    options,
  }));

  class NoObjectGeneratedErrorMock extends Error {
    response: unknown;
    constructor(finishReason?: string) {
      super('No object generated');
      this.name = 'NoObjectGeneratedError';
      this.response = { finishReason };
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

import { generateStructuredObject } from './generateStructuredObject';

describe('worker generateStructuredObject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.AI_POSTS_TIMEOUT_MS = 5_000;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('passes a provider-safe schema while preserving local validation', async () => {
    const schema = z.object({
      format: z.string(),
      suggestions: z.array(z.string().min(1).max(20)).min(2).max(5),
    });

    generateObjectMock.mockResolvedValueOnce({
      object: { format: 'markdown', suggestions: ['um', 'dois'] },
      usage: { inputTokens: 40, outputTokens: 12 },
    });

    await generateStructuredObject({
      model: 'openai/gpt-4o',
      system: 'Você é um assistente útil.',
      prompt: 'Gere um objeto.',
      schema,
      operation: 'worker-test',
    });

    const [providerSchema, options] = jsonSchemaMock.mock.calls[0] as [
      Record<string, unknown>,
      { validate: (value: unknown) => { success: boolean; value?: unknown; error?: Error } },
    ];
    const properties = providerSchema.properties as Record<string, Record<string, unknown>>;
    const suggestions = properties.suggestions as Record<string, unknown>;
    const suggestionItems = suggestions.items as Record<string, unknown>;

    expect(properties.format).toEqual(expect.objectContaining({ type: 'string' }));
    expect(suggestions).not.toHaveProperty('minItems');
    expect(suggestions).not.toHaveProperty('maxItems');
    expect(suggestionItems).not.toHaveProperty('minLength');
    expect(suggestionItems).not.toHaveProperty('maxLength');

    expect(options.validate({ format: 'markdown', suggestions: ['um', 'dois'] })).toEqual({
      success: true,
      value: { format: 'markdown', suggestions: ['um', 'dois'] },
    });
    expect(options.validate({ format: 'markdown', suggestions: ['um'] })).toMatchObject({
      success: false,
    });
  });
});
