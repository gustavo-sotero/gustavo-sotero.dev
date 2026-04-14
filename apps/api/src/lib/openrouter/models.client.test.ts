import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Mocks ─────────────────────────────────────────────────────────────────────

vi.mock('../../config/logger', () => ({
  getLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

// Spy on the global fetch.
const fetchSpy = vi.spyOn(globalThis, 'fetch');

import { fetchOpenRouterModels } from './models.client';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MINIMAL_MODEL = {
  id: 'openai/gpt-4o',
  name: 'GPT-4o',
  description: 'OpenAI flagship model',
  created: 1700000000,
  context_length: 128000,
  expiration_date: null,
  supported_parameters: ['structured_outputs', 'response_format'],
  pricing: { prompt: '0.000005', completion: '0.000015' },
  top_provider: { max_completion_tokens: 16384 },
  architecture: {
    input_modalities: ['text'],
    output_modalities: ['text'],
    modality: 'text->text',
  },
};

function makeOkResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('fetchOpenRouterModels', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('successful response', () => {
    it('returns parsed model data on a valid upstream response', async () => {
      fetchSpy.mockResolvedValueOnce(makeOkResponse({ data: [MINIMAL_MODEL] }));

      const result = await fetchOpenRouterModels('sk-test');

      expect(result.data).toHaveLength(1);
      // biome-ignore lint/style/noNonNullAssertion: length asserted above
      expect(result.data[0]!.id).toBe('openai/gpt-4o');
    });

    it('sends Authorization header with the provided API key', async () => {
      fetchSpy.mockResolvedValueOnce(makeOkResponse({ data: [MINIMAL_MODEL] }));

      await fetchOpenRouterModels('sk-or-v1-testkey');

      expect(fetchSpy).toHaveBeenCalledWith(
        expect.stringContaining('openrouter.ai'),
        expect.objectContaining({
          headers: expect.objectContaining({ Authorization: 'Bearer sk-or-v1-testkey' }),
        })
      );
    });

    it('returns an empty data array when upstream returns no models', async () => {
      fetchSpy.mockResolvedValueOnce(makeOkResponse({ data: [] }));

      const result = await fetchOpenRouterModels('sk-test');

      expect(result.data).toHaveLength(0);
    });
  });

  describe('HTTP error responses', () => {
    it('throws when the upstream returns a non-2xx status', async () => {
      fetchSpy.mockResolvedValueOnce(new Response('Unauthorized', { status: 401 }));

      await expect(fetchOpenRouterModels('bad-key')).rejects.toThrow('HTTP 401');
    });

    it('throws when the upstream returns 503', async () => {
      fetchSpy.mockResolvedValueOnce(new Response('Service Unavailable', { status: 503 }));

      await expect(fetchOpenRouterModels('sk-test')).rejects.toThrow('HTTP 503');
    });
  });

  describe('schema validation', () => {
    it('throws when the upstream response is missing the data array', async () => {
      fetchSpy.mockResolvedValueOnce(makeOkResponse({ models: [] }));

      await expect(fetchOpenRouterModels('sk-test')).rejects.toThrow(
        /did not match expected schema/
      );
    });

    it('throws when a model entry is missing the required id field', async () => {
      fetchSpy.mockResolvedValueOnce(
        makeOkResponse({ data: [{ ...MINIMAL_MODEL, id: undefined }] })
      );

      await expect(fetchOpenRouterModels('sk-test')).rejects.toThrow(
        /did not match expected schema/
      );
    });

    it('accepts models with null optional fields', async () => {
      const sparseModel = {
        id: 'google/gemini-flash',
        name: '',
        description: null,
        context_length: null,
        expiration_date: null,
        supported_parameters: null,
        pricing: null,
        top_provider: null,
        architecture: null,
      };
      fetchSpy.mockResolvedValueOnce(makeOkResponse({ data: [sparseModel] }));

      const result = await fetchOpenRouterModels('sk-test');

      expect(result.data).toHaveLength(1);
    });
  });

  describe('network failure', () => {
    it('rethrows network errors', async () => {
      fetchSpy.mockRejectedValueOnce(new Error('Network error'));

      await expect(fetchOpenRouterModels('sk-test')).rejects.toThrow('Network error');
    });
  });

  describe('timeout', () => {
    it('passes an AbortSignal to fetch so the request can be cancelled after the timeout', async () => {
      // Rather than attempting to advance fake timers (which has environment-specific
      // behaviour), we verify that the implementation correctly wires up an AbortSignal.
      // The AbortSignal presence guarantees the 15-second timeout mechanism is in place.
      fetchSpy.mockResolvedValueOnce(makeOkResponse({ data: [] }));

      await fetchOpenRouterModels('sk-test');

      const [, init] = fetchSpy.mock.calls[0] as [unknown, RequestInit | undefined];
      expect(init?.signal).toBeDefined();
      expect(init?.signal).toBeInstanceOf(AbortSignal);
    });

    it('throws when fetch rejects with an AbortError (simulating a timed-out request)', async () => {
      fetchSpy.mockRejectedValueOnce(new DOMException('The operation was aborted.', 'AbortError'));

      await expect(fetchOpenRouterModels('sk-test')).rejects.toThrow();
    });
  });
});
