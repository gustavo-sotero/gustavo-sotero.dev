import { describe, expect, it } from 'vitest';
import { extractProviderGenerationId } from './aiProviderGeneration';

describe('extractProviderGenerationId', () => {
  it('prefers response.id when available', () => {
    expect(
      extractProviderGenerationId({
        response: { id: 'gen_response', body: { id: 'gen_body' } },
        providerMetadata: { gateway: { generationId: 'gen_gateway' } },
      })
    ).toBe('gen_response');
  });

  it('falls back to response.body.id', () => {
    expect(
      extractProviderGenerationId({
        response: { body: { id: 'gen_body' } },
      })
    ).toBe('gen_body');
  });

  it('supports openrouter provider metadata when present', () => {
    expect(
      extractProviderGenerationId({
        providerMetadata: { openrouter: { generationId: 'gen_openrouter' } },
      })
    ).toBe('gen_openrouter');
  });

  it('supports gateway provider metadata when present', () => {
    expect(
      extractProviderGenerationId({
        providerMetadata: { gateway: { generationId: 'gen_gateway' } },
      })
    ).toBe('gen_gateway');
  });

  it('returns null when no generation id is exposed', () => {
    expect(extractProviderGenerationId({ response: { body: {} }, providerMetadata: {} })).toBe(
      null
    );
  });
});
