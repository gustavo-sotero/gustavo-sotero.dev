import type {
  AiPostGenerationConfig,
  AiPostGenerationConfigState,
  ProviderRoutingConfig,
  UpdateAiPostGenerationConfig,
} from '@portfolio/shared/schemas/ai-post-generation-config';
import { providerRoutingConfigSchema } from '@portfolio/shared/schemas/ai-post-generation-config';
import { env } from '../config/env';
import { getLogger } from '../config/logger';
import { AiConfigError } from '../lib/errors';
import {
  findAiPostGenerationSettings,
  upsertAiPostGenerationSettings,
} from '../repositories/ai-post-generation-settings.repo';
import { validateModelId } from './openrouter-models.service';

const logger = getLogger('services', 'ai-post-generation-settings');

function parsePersistedRoutingConfig(
  value: unknown,
  operation: 'topics' | 'draft'
): ProviderRoutingConfig | null | undefined {
  if (value == null) {
    return null;
  }

  const parsed = providerRoutingConfigSchema.safeParse(value);
  if (!parsed.success) {
    logger.warn('Ignoring invalid persisted AI provider routing config', {
      operation,
      issues: parsed.error.issues.map((issue) => issue.message),
    });
    return null;
  }

  return parsed.data;
}

// ── Config state resolution ───────────────────────────────────────────────────

/**
 * Read the current global AI post generation configuration state.
 *
 * The returned status follows the finite state machine:
 *  - `disabled`           — AI_POSTS_ENABLED=false
 *  - `not-configured`     — enabled but no row saved yet
 *  - `ready`              — enabled and persisted model IDs are currently valid
 *  - `invalid-config`     — saved model IDs no longer pass catalog validation
 *  - `catalog-unavailable`— catalog could not be loaded; saved IDs unverified
 */
export async function getAiPostGenerationConfigState(): Promise<AiPostGenerationConfigState> {
  if (!env.AI_POSTS_ENABLED) {
    return {
      featureEnabled: false,
      status: 'disabled',
      config: null,
      issues: ['Geração de posts com IA está desabilitada nesta instância.'],
      updatedAt: null,
      updatedBy: null,
      catalogFetchedAt: null,
    };
  }

  const row = await findAiPostGenerationSettings();

  if (!row?.topicsModelId || !row.draftModelId) {
    return {
      featureEnabled: true,
      status: 'not-configured',
      config: null,
      issues: ['Nenhum par de modelos foi configurado ainda.'],
      updatedAt: row?.updatedAt?.toISOString() ?? null,
      updatedBy: row?.updatedBy ?? null,
      catalogFetchedAt: null,
    };
  }

  const config: AiPostGenerationConfig = {
    topicsModelId: row.topicsModelId,
    draftModelId: row.draftModelId,
    topicsRouting: parsePersistedRoutingConfig(row.topicsRouting, 'topics'),
    draftRouting: parsePersistedRoutingConfig(row.draftRouting, 'draft'),
  };

  // Validate current selection against OpenRouter catalog
  try {
    const [topicsValid, draftValid] = await Promise.all([
      validateModelId(row.topicsModelId),
      validateModelId(row.draftModelId),
    ]);

    const issues: string[] = [];
    if (!topicsValid)
      issues.push(
        `Modelo de tópicos "${row.topicsModelId}" não está disponível ou não suporta saída estruturada.`
      );
    if (!draftValid)
      issues.push(
        `Modelo de rascunho "${row.draftModelId}" não está disponível ou não suporta saída estruturada.`
      );

    const catalogFetchedAt = new Date().toISOString();

    if (issues.length > 0) {
      return {
        featureEnabled: true,
        status: 'invalid-config',
        config,
        issues,
        updatedAt: row.updatedAt.toISOString(),
        updatedBy: row.updatedBy ?? null,
        catalogFetchedAt,
      };
    }

    return {
      featureEnabled: true,
      status: 'ready',
      config,
      issues: [],
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy ?? null,
      catalogFetchedAt,
    };
  } catch (err) {
    // Catalog unavailable — cannot confirm validity of saved config
    logger.warn('Could not validate AI config against OpenRouter catalog', {
      error: (err as Error).message,
    });

    return {
      featureEnabled: true,
      status: 'catalog-unavailable',
      config,
      issues: ['Catálogo de modelos temporariamente indisponível. Validação adiada.'],
      updatedAt: row.updatedAt.toISOString(),
      updatedBy: row.updatedBy ?? null,
      catalogFetchedAt: null,
    };
  }
}

// ── Config update ─────────────────────────────────────────────────────────────

/**
 * Validate and persist the active AI post generation configuration.
 *
 * Hard gates (will throw with typed errors):
 *  - Feature disabled by env
 *  - OPENROUTER_API_KEY missing
 *  - Catalog fetch failure (cannot validate)
 *  - Either model ID not eligible (not found or no structured_outputs)
 *
 * Returns the normalized saved config state on success.
 */
export async function saveAiPostGenerationConfig(
  input: UpdateAiPostGenerationConfig,
  updatedBy: string
): Promise<AiPostGenerationConfigState> {
  if (!env.AI_POSTS_ENABLED) {
    throw new AiConfigError('DISABLED', 'AI post generation is disabled');
  }

  if (!env.OPENROUTER_API_KEY) {
    throw new AiConfigError('NO_API_KEY', 'OPENROUTER_API_KEY is not configured');
  }

  // Save-time validation: both models must exist in catalog with structured_outputs
  let topicsValid: boolean;
  let draftValid: boolean;

  try {
    [topicsValid, draftValid] = await Promise.all([
      validateModelId(input.topicsModelId),
      validateModelId(input.draftModelId),
    ]);
  } catch (err) {
    throw new AiConfigError(
      'CATALOG_UNAVAILABLE',
      'Não foi possível validar os modelos: catálogo do OpenRouter indisponível',
      { cause: err }
    );
  }

  const issues: string[] = [];
  if (!topicsValid)
    issues.push(
      `Modelo de tópicos "${input.topicsModelId}" não está disponível ou não suporta saída estruturada.`
    );
  if (!draftValid)
    issues.push(
      `Modelo de rascunho "${input.draftModelId}" não está disponível ou não suporta saída estruturada.`
    );

  if (issues.length > 0) {
    throw new AiConfigError('INVALID_MODELS', issues.join(' '), { issues });
  }

  await upsertAiPostGenerationSettings({
    topicsModelId: input.topicsModelId,
    draftModelId: input.draftModelId,
    topicsRouting: input.topicsRouting ?? null,
    draftRouting: input.draftRouting ?? null,
    updatedBy,
  });

  logger.info('AI post generation config saved', {
    topicsModelId: input.topicsModelId,
    draftModelId: input.draftModelId,
    updatedBy,
  });

  return getAiPostGenerationConfigState();
}

// ── Active config resolution (for generation service) ────────────────────────

/**
 * Resolve the active AI post generation configuration for use by the
 * generation service before making an AI call.
 *
 * Throws `AiConfigError` when the feature is unavailable or invalid:
 *  - `DISABLED`       — feature is off
 *  - `NOT_CONFIGURED` — no model pair saved yet
 *  - `INVALID_CONFIG` — saved models fail catalog validation
 */
export async function resolveActiveAiPostGenerationConfig(): Promise<AiPostGenerationConfig> {
  if (!env.AI_POSTS_ENABLED) {
    throw new AiConfigError('DISABLED', 'AI post generation is disabled');
  }

  const row = await findAiPostGenerationSettings();

  if (!row?.topicsModelId || !row.draftModelId) {
    throw new AiConfigError('NOT_CONFIGURED', 'AI post generation is not configured');
  }

  // Best-effort: validate against cached catalog if available.
  // If catalog is unavailable, allow the call through — the saved config was
  // previously validated at save-time and requireParameters=true will enforce
  // structured output constraints at the provider level.
  try {
    const [topicsValid, draftValid] = await Promise.all([
      validateModelId(row.topicsModelId),
      validateModelId(row.draftModelId),
    ]);

    if (!topicsValid || !draftValid) {
      throw new AiConfigError(
        'INVALID_CONFIG',
        'AI post generation config contains invalid model IDs'
      );
    }
  } catch (err) {
    // Re-throw typed config errors; swallow catalog fetch failures gracefully.
    if (err instanceof AiConfigError) {
      throw err;
    }
    // Catalog unavailable — proceed with saved config
    logger.warn(
      'Catalog unavailable during generation config resolution — proceeding with saved config',
      {
        error: (err as Error).message,
      }
    );
  }

  return {
    topicsModelId: row.topicsModelId,
    draftModelId: row.draftModelId,
    topicsRouting: parsePersistedRoutingConfig(row.topicsRouting, 'topics'),
    draftRouting: parsePersistedRoutingConfig(row.draftRouting, 'draft'),
  };
}

// ── Operation-specific config resolution ─────────────────────────────────────

/**
 * Resolve only the topics model for topic generation.
 *
 * Decoupled from draft model validity so topic generation does not fail
 * because of an unrelated draft model configuration issue.
 *
 * Throws `AiConfigError` when the feature is unavailable or invalid:
 *  - `DISABLED`       — feature is off
 *  - `NOT_CONFIGURED` — no topics model saved yet
 *  - `INVALID_CONFIG` — saved topics model fails catalog validation
 */
export async function resolveActiveAiTopicGenerationConfig(): Promise<
  Pick<AiPostGenerationConfig, 'topicsModelId' | 'topicsRouting'>
> {
  if (!env.AI_POSTS_ENABLED) {
    throw new AiConfigError('DISABLED', 'AI post generation is disabled');
  }

  const row = await findAiPostGenerationSettings();

  if (!row?.topicsModelId) {
    throw new AiConfigError('NOT_CONFIGURED', 'Topics model is not configured');
  }

  // Best-effort catalog validation — proceed if catalog is unavailable.
  try {
    const topicsValid = await validateModelId(row.topicsModelId);
    if (!topicsValid) {
      throw new AiConfigError('INVALID_CONFIG', 'Topics model ID is invalid or unavailable');
    }
  } catch (err) {
    if (err instanceof AiConfigError) {
      throw err;
    }
    logger.warn(
      'Catalog unavailable during topic config resolution — proceeding with saved config',
      { error: (err as Error).message }
    );
  }

  return {
    topicsModelId: row.topicsModelId,
    topicsRouting: parsePersistedRoutingConfig(row.topicsRouting, 'topics'),
  };
}

/**
 * Resolve only the draft model for draft generation.
 *
 * Decoupled from topics model validity so draft generation does not fail
 * because of an unrelated topics model configuration issue.
 *
 * Throws `AiConfigError` when the feature is unavailable or invalid:
 *  - `DISABLED`       — feature is off
 *  - `NOT_CONFIGURED` — no draft model saved yet
 *  - `INVALID_CONFIG` — saved draft model fails catalog validation
 */
export async function resolveActiveAiDraftGenerationConfig(): Promise<
  Pick<AiPostGenerationConfig, 'draftModelId' | 'draftRouting'>
> {
  if (!env.AI_POSTS_ENABLED) {
    throw new AiConfigError('DISABLED', 'AI post generation is disabled');
  }

  const row = await findAiPostGenerationSettings();

  if (!row?.draftModelId) {
    throw new AiConfigError('NOT_CONFIGURED', 'Draft model is not configured');
  }

  // Best-effort catalog validation — proceed if catalog is unavailable.
  try {
    const draftValid = await validateModelId(row.draftModelId);
    if (!draftValid) {
      throw new AiConfigError('INVALID_CONFIG', 'Draft model ID is invalid or unavailable');
    }
  } catch (err) {
    if (err instanceof AiConfigError) {
      throw err;
    }
    logger.warn(
      'Catalog unavailable during draft config resolution — proceeding with saved config',
      { error: (err as Error).message }
    );
  }

  return {
    draftModelId: row.draftModelId,
    draftRouting: parsePersistedRoutingConfig(row.draftRouting, 'draft'),
  };
}
