/**
 * Shared AI generation error class.
 *
 * Used by both the API (generateStructuredObject) and the worker job processor.
 * Centralised here so both processes can use `instanceof AiGenerationError`
 * with the same class reference.
 */

export type AiGenerationErrorKind =
  | 'timeout'
  | 'refusal'
  | 'validation'
  | 'provider'
  | 'disabled'
  | 'not-configured'
  | 'invalid-config'
  | 'catalog-unavailable';

export class AiGenerationError extends Error {
  readonly kind: AiGenerationErrorKind;

  constructor(kind: AiGenerationErrorKind, message: string) {
    super(message);
    this.name = 'AiGenerationError';
    this.kind = kind;
  }
}
