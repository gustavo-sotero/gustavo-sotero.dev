import { beforeEach, describe, expect, it, vi } from 'vitest';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────
const {
  envMock,
  findAiPostGenerationSettingsMock,
  upsertAiPostGenerationSettingsMock,
  validateModelIdMock,
} = vi.hoisted(() => ({
  envMock: {
    AI_POSTS_ENABLED: true,
    OPENROUTER_API_KEY: 'sk-test',
  },
  findAiPostGenerationSettingsMock: vi.fn(),
  upsertAiPostGenerationSettingsMock: vi.fn(),
  validateModelIdMock: vi.fn(),
}));

vi.mock('../config/env', () => ({ env: envMock }));

vi.mock('../repositories/ai-post-generation-settings.repo', () => ({
  findAiPostGenerationSettings: findAiPostGenerationSettingsMock,
  upsertAiPostGenerationSettings: upsertAiPostGenerationSettingsMock,
}));

vi.mock('./openrouter-models.service', () => ({
  validateModelId: validateModelIdMock,
}));

import {
  getAiPostGenerationConfigState,
  resolveActiveAiPostGenerationConfig,
  saveAiPostGenerationConfig,
} from './ai-post-generation-settings.service';

const SAVED_ROW = {
  scope: 'global',
  topicsModelId: 'openai/gpt-4o',
  draftModelId: 'openai/gpt-4o',
  updatedBy: 'admin',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-01'),
};

describe('ai-post-generation-settings.service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    envMock.AI_POSTS_ENABLED = true;
    envMock.OPENROUTER_API_KEY = 'sk-test';
    validateModelIdMock.mockResolvedValue(true);
    findAiPostGenerationSettingsMock.mockResolvedValue(SAVED_ROW);
    upsertAiPostGenerationSettingsMock.mockResolvedValue(undefined);
  });

  // ── getAiPostGenerationConfigState ─────────────────────────────────────────

  describe('getAiPostGenerationConfigState', () => {
    it('returns disabled status when feature is off', async () => {
      envMock.AI_POSTS_ENABLED = false;

      const state = await getAiPostGenerationConfigState();

      expect(state.status).toBe('disabled');
      expect(state.featureEnabled).toBe(false);
      expect(state.config).toBeNull();
    });

    it('returns not-configured when no row exists', async () => {
      findAiPostGenerationSettingsMock.mockResolvedValue(null);

      const state = await getAiPostGenerationConfigState();

      expect(state.status).toBe('not-configured');
      expect(state.config).toBeNull();
    });

    it('returns not-configured when row has null model IDs', async () => {
      findAiPostGenerationSettingsMock.mockResolvedValue({
        ...SAVED_ROW,
        topicsModelId: null,
        draftModelId: null,
      });

      const state = await getAiPostGenerationConfigState();

      expect(state.status).toBe('not-configured');
    });

    it('returns ready when both models pass catalog validation', async () => {
      validateModelIdMock.mockResolvedValue(true);

      const state = await getAiPostGenerationConfigState();

      expect(state.status).toBe('ready');
      expect(state.config?.topicsModelId).toBe('openai/gpt-4o');
      expect(state.issues).toHaveLength(0);
    });

    it('returns invalid-config when topics model fails validation', async () => {
      validateModelIdMock
        .mockResolvedValueOnce(false) // topics invalid
        .mockResolvedValueOnce(true); // draft valid

      const state = await getAiPostGenerationConfigState();

      expect(state.status).toBe('invalid-config');
      expect(state.issues.length).toBeGreaterThan(0);
    });

    it('returns catalog-unavailable when validateModelId throws', async () => {
      validateModelIdMock.mockRejectedValue(new Error('network error'));

      const state = await getAiPostGenerationConfigState();

      expect(state.status).toBe('catalog-unavailable');
      expect(state.config).not.toBeNull();
    });
  });

  // ── saveAiPostGenerationConfig ─────────────────────────────────────────────

  describe('saveAiPostGenerationConfig', () => {
    const VALID_INPUT = { topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' };

    it('saves config and returns updated state on success', async () => {
      const state = await saveAiPostGenerationConfig(VALID_INPUT, 'admin');

      expect(upsertAiPostGenerationSettingsMock).toHaveBeenCalledWith({
        topicsModelId: 'openai/gpt-4o',
        draftModelId: 'openai/gpt-4o',
        updatedBy: 'admin',
      });
      expect(state.status).toBe('ready');
    });

    it('throws DISABLED when feature is off', async () => {
      envMock.AI_POSTS_ENABLED = false;

      await expect(saveAiPostGenerationConfig(VALID_INPUT, 'admin')).rejects.toMatchObject({
        code: 'DISABLED',
      });
    });

    it('throws NO_API_KEY when OPENROUTER_API_KEY is missing', async () => {
      envMock.OPENROUTER_API_KEY = undefined as unknown as string;

      await expect(saveAiPostGenerationConfig(VALID_INPUT, 'admin')).rejects.toMatchObject({
        code: 'NO_API_KEY',
      });
    });

    it('throws CATALOG_UNAVAILABLE when validateModelId throws', async () => {
      validateModelIdMock.mockRejectedValue(new Error('network error'));

      await expect(saveAiPostGenerationConfig(VALID_INPUT, 'admin')).rejects.toMatchObject({
        code: 'CATALOG_UNAVAILABLE',
      });
    });

    it('throws INVALID_MODELS when both models fail validation', async () => {
      validateModelIdMock.mockResolvedValue(false);

      await expect(saveAiPostGenerationConfig(VALID_INPUT, 'admin')).rejects.toMatchObject({
        code: 'INVALID_MODELS',
      });
    });

    it('does not call upsert when models fail validation', async () => {
      validateModelIdMock.mockResolvedValue(false);

      await expect(saveAiPostGenerationConfig(VALID_INPUT, 'admin')).rejects.toThrow();
      expect(upsertAiPostGenerationSettingsMock).not.toHaveBeenCalled();
    });
  });

  // ── resolveActiveAiPostGenerationConfig ────────────────────────────────────

  describe('resolveActiveAiPostGenerationConfig', () => {
    it('returns active config when ready', async () => {
      const config = await resolveActiveAiPostGenerationConfig();

      expect(config.topicsModelId).toBe('openai/gpt-4o');
      expect(config.draftModelId).toBe('openai/gpt-4o');
    });

    it('throws DISABLED when feature is off', async () => {
      envMock.AI_POSTS_ENABLED = false;

      await expect(resolveActiveAiPostGenerationConfig()).rejects.toMatchObject({
        code: 'DISABLED',
      });
    });

    it('throws NOT_CONFIGURED when no row exists', async () => {
      findAiPostGenerationSettingsMock.mockResolvedValue(null);

      await expect(resolveActiveAiPostGenerationConfig()).rejects.toMatchObject({
        code: 'NOT_CONFIGURED',
      });
    });

    it('throws INVALID_CONFIG when saved model fails catalog validation', async () => {
      validateModelIdMock.mockResolvedValue(false);

      await expect(resolveActiveAiPostGenerationConfig()).rejects.toMatchObject({
        code: 'INVALID_CONFIG',
      });
    });

    it('proceeds with saved config when catalog is unavailable', async () => {
      validateModelIdMock.mockRejectedValue(new Error('network error'));

      // Should NOT throw — catalog failure is swallowed for resilience
      const config = await resolveActiveAiPostGenerationConfig();

      expect(config.topicsModelId).toBe('openai/gpt-4o');
    });
  });
});
