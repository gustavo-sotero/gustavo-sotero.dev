import { type ZodSchema, z } from 'zod';

// Azure OpenAI and OpenAI structured outputs support only a restricted JSON
// Schema subset. These keywords are valid JSON Schema, but the provider rejects
// them during request validation.
const UNSUPPORTED_OPENAI_STRUCTURED_OUTPUT_KEYWORDS = new Set([
  'contains',
  'exclusiveMaximum',
  'exclusiveMinimum',
  'format',
  'maxContains',
  'maxItems',
  'maxLength',
  'maxProperties',
  'maximum',
  'minContains',
  'minItems',
  'minLength',
  'minProperties',
  'minimum',
  'multipleOf',
  'pattern',
  'patternProperties',
  'propertyNames',
  'unevaluatedItems',
  'unevaluatedProperties',
  'uniqueItems',
]);

// In these JSON Schema objects, the keys are user-defined names rather than
// JSON Schema keywords. We must preserve names like `format` or `minimum` when
// they appear here as actual payload fields.
const JSON_SCHEMA_NAMED_SCHEMA_MAP_KEYS = new Set([
  '$defs',
  'definitions',
  'dependentSchemas',
  'properties',
]);

/**
 * Converts a Zod schema into the JSON Schema subset accepted by OpenAI/Azure
 * structured outputs. The original Zod schema must still be used for final
 * validation because provider-facing constraints like min/max lengths are
 * intentionally stripped here.
 */
export function toOpenAiCompatibleStructuredOutputJsonSchema(
  schema: ZodSchema
): Record<string, unknown> {
  return sanitizeOpenAiStructuredOutputJsonSchema(z.toJSONSchema(schema)) as Record<
    string,
    unknown
  >;
}

function sanitizeOpenAiStructuredOutputJsonSchema(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeOpenAiStructuredOutputJsonSchema);
  }

  if (value === null || typeof value !== 'object') {
    return value;
  }

  return sanitizeSchemaObject(value as Record<string, unknown>);
}

function sanitizeSchemaObject(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    if (UNSUPPORTED_OPENAI_STRUCTURED_OUTPUT_KEYWORDS.has(key)) {
      continue;
    }

    if (
      JSON_SCHEMA_NAMED_SCHEMA_MAP_KEYS.has(key) &&
      child !== null &&
      typeof child === 'object' &&
      !Array.isArray(child)
    ) {
      sanitized[key] = sanitizeNamedSchemaMap(child as Record<string, unknown>);
      continue;
    }

    sanitized[key] = sanitizeOpenAiStructuredOutputJsonSchema(child);
  }

  return sanitized;
}

function sanitizeNamedSchemaMap(value: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = {};

  for (const [key, child] of Object.entries(value)) {
    sanitized[key] = sanitizeOpenAiStructuredOutputJsonSchema(child);
  }

  return sanitized;
}
