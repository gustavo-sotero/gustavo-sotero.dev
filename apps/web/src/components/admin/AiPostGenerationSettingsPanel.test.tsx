'use client';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

const useAiPostGenerationConfigMock = vi.fn();
const useAiPostGenerationModelsMock = vi.fn();
const useUpdateAiPostGenerationConfigMock = vi.fn();

vi.mock('@/hooks/admin/use-ai-post-generation-config', () => ({
  useAiPostGenerationConfig: () => useAiPostGenerationConfigMock(),
  useAiPostGenerationModels: (params: unknown) => useAiPostGenerationModelsMock(params),
  useUpdateAiPostGenerationConfig: () => useUpdateAiPostGenerationConfigMock(),
}));

// Stub out low-level UI libraries
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled}>
      {children}
    </button>
  ),
}));

vi.mock('@/components/ui/input', () => ({
  Input: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('@/components/ui/label', () => ({
  Label: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

vi.mock('@/components/ui/skeleton', () => ({
  Skeleton: () => <div data-testid="skeleton" />,
}));

import { AiPostGenerationSettingsPanel } from './AiPostGenerationSettingsPanel';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const READY_CONFIG_STATE = {
  featureEnabled: true,
  status: 'ready' as const,
  config: { topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' },
  issues: [],
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'admin',
  catalogFetchedAt: '2026-01-01T00:00:00.000Z',
};

const EMPTY_CONFIG_STATE = {
  featureEnabled: true,
  status: 'not-configured' as const,
  config: null,
  issues: ['Nenhum par de modelos foi configurado ainda.'],
  updatedAt: null,
  updatedBy: null,
  catalogFetchedAt: null,
};

const DISABLED_CONFIG_STATE = {
  featureEnabled: false,
  status: 'disabled' as const,
  config: null,
  issues: ['Geração de posts com IA está desabilitada nesta instância.'],
  updatedAt: null,
  updatedBy: null,
  catalogFetchedAt: null,
};

const INVALID_CONFIG_STATE = {
  featureEnabled: true,
  status: 'invalid-config' as const,
  config: { topicsModelId: 'old/gone', draftModelId: 'old/gone' },
  issues: ['Modelo de tópicos "old/gone" não está disponível.'],
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'admin',
  catalogFetchedAt: '2026-01-01T00:00:00.000Z',
};

const CATALOG_UNAVAILABLE_STATE = {
  featureEnabled: true,
  status: 'catalog-unavailable' as const,
  config: { topicsModelId: 'openai/gpt-4o', draftModelId: 'openai/gpt-4o' },
  issues: ['Catálogo de modelos temporariamente indisponível.'],
  updatedAt: '2026-01-01T00:00:00.000Z',
  updatedBy: 'admin',
  catalogFetchedAt: null,
};

const ELIGIBLE_MODELS = [
  { id: 'openai/gpt-4o', name: 'GPT-4o', contextLength: 128000, supportsStructuredOutputs: true },
  {
    id: 'anthropic/claude-3-5-sonnet',
    name: 'Claude 3.5 Sonnet',
    contextLength: 200000,
    supportsStructuredOutputs: true,
  },
];

const EMPTY_MODELS_RESPONSE = { data: [], meta: { page: 1, perPage: 20, total: 0, totalPages: 0 } };
const MODELS_RESPONSE = {
  data: ELIGIBLE_MODELS,
  meta: { page: 1, perPage: 50, total: 2, totalPages: 1 },
};

const muteMock = vi.fn();

function setupDefaultMocks() {
  useAiPostGenerationModelsMock.mockReturnValue({ data: MODELS_RESPONSE, isLoading: false });
  useUpdateAiPostGenerationConfigMock.mockReturnValue({ mutate: muteMock, isPending: false });
}

function renderPanel() {
  return render(<AiPostGenerationSettingsPanel />);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('AiPostGenerationSettingsPanel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    cleanup();
  });

  // ── Disabled state ─────────────────────────────────────────────────────────

  it('shows disabled message and hides model selectors when feature is disabled', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: DISABLED_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getByText(/desabilitada/i)).toBeInTheDocument();
    // Model selector section should not be visible
    expect(screen.queryByText(/Modelos ativos/i)).not.toBeInTheDocument();
  });

  // ── Not configured state ───────────────────────────────────────────────────

  it('renders model selectors when not-configured (allows first configuration)', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: EMPTY_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getByText(/Modelos ativos/i)).toBeInTheDocument();
    // Issues should be surfaced
    expect(screen.getByText(/Nenhum par de modelos foi configurado/i)).toBeInTheDocument();
  });

  // ── Ready state ────────────────────────────────────────────────────────────

  it('renders ready status badge with correct label', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: READY_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getByText('Pronto')).toBeInTheDocument();
  });

  it('pre-fills selectors with saved config values', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: READY_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    // The saved model IDs should appear in the "Selecionado:" labels
    const selected = screen.getAllByText(/openai\/gpt-4o/);
    expect(selected.length).toBeGreaterThan(0);
  });

  it('shows model list items from the catalog', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: READY_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getAllByText('GPT-4o').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Claude 3.5 Sonnet').length).toBeGreaterThan(0);
  });

  it('save button is disabled when both model selections are empty', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: EMPTY_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useAiPostGenerationModelsMock.mockReturnValue({
      data: EMPTY_MODELS_RESPONSE,
      isLoading: false,
    });

    renderPanel();

    const saveBtn = screen.getByRole('button', { name: /Salvar configuração/i });
    expect(saveBtn).toBeDisabled();
  });

  it('calls mutate with correct model IDs when a model is selected and saved', async () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: READY_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    // Click on a model in the topics list (rendered as buttons)
    const modelButtons = screen.getAllByRole('button', { name: /Claude 3.5 Sonnet/i });
    const firstModelBtn = modelButtons[0];
    if (firstModelBtn) fireEvent.click(firstModelBtn);

    const saveBtn = screen.getByRole('button', { name: /Salvar configuração/i });
    fireEvent.click(saveBtn);

    await waitFor(() => {
      expect(muteMock).toHaveBeenCalledWith(
        expect.objectContaining({
          topicsModelId: 'anthropic/claude-3-5-sonnet',
        })
      );
    });
  });

  // ── Invalid-config state ───────────────────────────────────────────────────

  it('shows invalid-config status badge and surfaces issues', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: INVALID_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getByText('Configuração inválida')).toBeInTheDocument();
    expect(screen.getByText(/Modelo de tópicos "old\/gone"/i)).toBeInTheDocument();
  });

  // ── Catalog-unavailable state ──────────────────────────────────────────────

  it('shows catalog-unavailable badge and issues when catalog cannot be loaded', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: CATALOG_UNAVAILABLE_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getByText('Catálogo indisponível')).toBeInTheDocument();
    expect(screen.getByText(/temporariamente indispon/i)).toBeInTheDocument();
  });

  // ── Loading state ──────────────────────────────────────────────────────────

  it('shows skeleton loaders while config is loading', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    // Skeletons should be present
    expect(screen.getAllByTestId('skeleton').length).toBeGreaterThan(0);
    // Status badge should not render yet
    expect(screen.queryByText(/Modelos ativos/i)).not.toBeInTheDocument();
  });

  it('shows error state and retry button when config fails to load', () => {
    const refetchMock = vi.fn();
    useAiPostGenerationConfigMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
      refetch: refetchMock,
    });

    renderPanel();

    expect(screen.getByText(/Erro ao carregar configuração/i)).toBeInTheDocument();
    const retryBtn = screen.getByRole('button', { name: /Tentar novamente/i });
    fireEvent.click(retryBtn);
    expect(refetchMock).toHaveBeenCalledOnce();
  });
});
