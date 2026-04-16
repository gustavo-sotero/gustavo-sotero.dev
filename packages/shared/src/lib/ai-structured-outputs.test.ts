import { describe, expect, it } from 'vitest';
import { z } from 'zod';

import { toOpenAiCompatibleStructuredOutputJsonSchema } from './ai-structured-outputs';

describe('toOpenAiCompatibleStructuredOutputJsonSchema', () => {
  it('removes unsupported type-specific keywords while preserving the object shape', () => {
    const schema = z.object({
      title: z.string().min(1).max(120),
      suggestions: z.array(z.string().min(1).max(20)).min(2).max(5),
      metadata: z.object({
        count: z.number().int().min(1).max(10),
      }),
    });

    const jsonSchema = toOpenAiCompatibleStructuredOutputJsonSchema(schema);
    const properties = jsonSchema.properties as Record<string, Record<string, unknown>>;
    const suggestions = properties.suggestions as Record<string, unknown>;
    const title = properties.title as Record<string, unknown>;
    const metadata = properties.metadata as Record<string, unknown>;
    const metadataProperties = metadata.properties as Record<string, Record<string, unknown>>;

    expect(jsonSchema.type).toBe('object');
    expect(jsonSchema.additionalProperties).toBe(false);
    expect(jsonSchema.required).toEqual(
      expect.arrayContaining(['title', 'suggestions', 'metadata'])
    );

    expect(title.type).toBe('string');
    expect(title).not.toHaveProperty('minLength');
    expect(title).not.toHaveProperty('maxLength');

    expect(suggestions.type).toBe('array');
    expect(suggestions).not.toHaveProperty('minItems');
    expect(suggestions).not.toHaveProperty('maxItems');
    expect(suggestions.items).not.toHaveProperty('minLength');
    expect(suggestions.items).not.toHaveProperty('maxLength');

    expect(metadata.type).toBe('object');
    expect(metadata.additionalProperties).toBe(false);
    expect(metadataProperties.count).not.toHaveProperty('minimum');
    expect(metadataProperties.count).not.toHaveProperty('maximum');
  });

  it('preserves payload field names that match unsupported keyword names', () => {
    const schema = z.object({
      format: z.string(),
      minItems: z.number(),
      nested: z.object({
        maximum: z.string(),
      }),
    });

    const jsonSchema = toOpenAiCompatibleStructuredOutputJsonSchema(schema);
    const properties = jsonSchema.properties as Record<string, Record<string, unknown>>;
    const nested = properties.nested as Record<string, unknown>;
    const nestedProperties = nested.properties as Record<string, Record<string, unknown>>;

    expect(properties.format).toEqual(expect.objectContaining({ type: 'string' }));
    expect(properties.minItems).toEqual(expect.objectContaining({ type: 'number' }));
    expect(nestedProperties.maximum).toEqual(expect.objectContaining({ type: 'string' }));
  });
});
