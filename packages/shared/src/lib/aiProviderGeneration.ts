function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface ProviderGenerationSource {
  response?: {
    id?: unknown;
    body?: unknown;
  } | null;
  providerMetadata?: unknown;
}

/**
 * Extracts a provider generation ID from AI SDK results across supported
 * providers and transports.
 *
 * Priority order:
 *  1. `response.id` from providers that expose HTTP response metadata
 *  2. `response.body.id` when the raw provider payload is available
 *  3. `providerMetadata.openrouter.generationId` if the provider exposes it
 *  4. `providerMetadata.gateway.generationId` for AI Gateway integrations
 */
export function extractProviderGenerationId(
  source: ProviderGenerationSource | null | undefined
): string | null {
  const responseId = typeof source?.response?.id === 'string' ? source.response.id.trim() : '';
  if (responseId) {
    return responseId;
  }

  const responseBody = isRecord(source?.response?.body) ? source.response.body : null;
  const responseBodyId = typeof responseBody?.id === 'string' ? responseBody.id.trim() : '';
  if (responseBodyId) {
    return responseBodyId;
  }

  const providerMetadata = isRecord(source?.providerMetadata) ? source.providerMetadata : null;

  const openrouterMetadata = isRecord(providerMetadata?.openrouter)
    ? providerMetadata.openrouter
    : null;
  const openrouterGenerationId =
    typeof openrouterMetadata?.generationId === 'string'
      ? openrouterMetadata.generationId.trim()
      : '';
  if (openrouterGenerationId) {
    return openrouterGenerationId;
  }

  const gatewayMetadata = isRecord(providerMetadata?.gateway) ? providerMetadata.gateway : null;
  const gatewayGenerationId =
    typeof gatewayMetadata?.generationId === 'string' ? gatewayMetadata.generationId.trim() : '';

  return gatewayGenerationId || null;
}
