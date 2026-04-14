import type {
  AiPostGenerationConfig,
  AiPostGenerationConfigState,
  UpdateAiPostGenerationConfig,
} from '@portfolio/shared';
import { env } from '../config/env';
import { getLogger } from '../config/logger';
import {
  findAiPostGenerationSettings,
  upsertAiPostGenerationSettings,
} from '../repositories/ai-post-generation-settings.repo';
import { validateModelId } from './openrouter-models.service';

const logger = getLogger('services', 'ai-post-generation-settings');

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
    const err = new Error('AI post generation is disabled');
    Object.assign(err, { code: 'DISABLED' });
    throw err;
  }

  if (!env.OPENROUTER_API_KEY) {
    const err = new Error('OPENROUTER_API_KEY is not configured');
    Object.assign(err, { code: 'NO_API_KEY' });
    throw err;
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
    const error = new Error(
      'Não foi possível validar os modelos: catálogo do OpenRouter indisponível'
    );
    Object.assign(error, { code: 'CATALOG_UNAVAILABLE', cause: err });
    throw error;
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
    const err = new Error(issues.join(' '));
    Object.assign(err, { code: 'INVALID_MODELS', issues });
    throw err;
  }

  await upsertAiPostGenerationSettings({
    topicsModelId: input.topicsModelId,
    draftModelId: input.draftModelId,
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
 * Throws with `code` set to signal the caller what went wrong:
 *  - `DISABLED`        — feature is off
 *  - `NOT_CONFIGURED`  — no model pair saved yet
 *  - `INVALID_CONFIG`  — saved models fail catalog validation
 */
export async function resolveActiveAiPostGenerationConfig(): Promise<AiPostGenerationConfig> {
  if (!env.AI_POSTS_ENABLED) {
    throw Object.assign(new Error('AI post generation is disabled'), { code: 'DISABLED' });
  }

  const row = await findAiPostGenerationSettings();

  if (!row?.topicsModelId || !row.draftModelId) {
    throw Object.assign(new Error('AI post generation is not configured'), {
      code: 'NOT_CONFIGURED',
    });
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
      throw Object.assign(new Error('AI post generation config contains invalid model IDs'), {
        code: 'INVALID_CONFIG',
      });
    }
  } catch (err) {
    const code = (err as { code?: string }).code;
    // Re-throw typed config errors; swallow catalog fetch failures gracefully
    if (code === 'DISABLED' || code === 'NOT_CONFIGURED' || code === 'INVALID_CONFIG') {
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
  };
}
