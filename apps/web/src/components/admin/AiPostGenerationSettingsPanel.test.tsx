'use client';

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ──────────────────────────────────────────────────────────────

const useAiPostGenerationConfigMock = vi.fn();
const useAiPostGenerationModelsMock = vi.fn();
const useUpdateAiPostGenerationConfigMock = vi.fn();
const getAiPostGenerationModelsMock = vi.fn();
const fetchQueryMock = vi.fn();

vi.mock('@/hooks/admin/use-ai-post-generation-config', () => ({
  useAiPostGenerationConfig: () => useAiPostGenerationConfigMock(),
  useAiPostGenerationModels: (params: unknown) => useAiPostGenerationModelsMock(params),
  useUpdateAiPostGenerationConfig: () => useUpdateAiPostGenerationConfigMock(),
  getAiPostGenerationModels: (params: unknown) => getAiPostGenerationModelsMock(params),
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({
    fetchQuery: fetchQueryMock,
  }),
}));

// Stub out low-level UI libraries
vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    ...rest
  }: {
    children: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    [key: string]: unknown;
  }) => (
    <button type="button" onClick={onClick} disabled={disabled} {...rest}>
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
  {
    id: 'openai/gpt-4o',
    providerFamily: 'openai',
    name: 'GPT-4o',
    description: 'Modelo multimodal da OpenAI com boa aderência a JSON schema.',
    contextLength: 128000,
    maxCompletionTokens: 16384,
    inputPrice: '0.0000025',
    outputPrice: '0.00001',
    supportsStructuredOutputs: true,
    expirationDate: null,
    isDeprecated: false,
  },
  {
    id: 'anthropic/claude-3-5-sonnet',
    providerFamily: 'anthropic',
    name: 'Claude 3.5 Sonnet',
    description: 'Modelo equilibrado para raciocínio e geração longa.',
    contextLength: 200000,
    maxCompletionTokens: 8192,
    inputPrice: '0.000003',
    outputPrice: '0.000015',
    supportsStructuredOutputs: true,
    expirationDate: null,
    isDeprecated: false,
  },
];

const SECOND_PAGE_MODELS = [
  {
    id: 'google/gemini-2.5-pro',
    providerFamily: 'google',
    name: 'Gemini 2.5 Pro',
    description: 'Janela ampla para drafts mais densos.',
    contextLength: 1000000,
    maxCompletionTokens: 65536,
    inputPrice: '0.00000125',
    outputPrice: '0.000005',
    supportsStructuredOutputs: true,
    expirationDate: null,
    isDeprecated: false,
  },
];

const EMPTY_MODELS_RESPONSE = { data: [], meta: { page: 1, perPage: 8, total: 0, totalPages: 1 } };
const MODELS_RESPONSE = {
  data: ELIGIBLE_MODELS,
  meta: { page: 1, perPage: 8, total: 9, totalPages: 2 },
};
const MODELS_RESPONSE_PAGE_2 = {
  data: SECOND_PAGE_MODELS,
  meta: { page: 2, perPage: 8, total: 9, totalPages: 2 },
};

const muteMock = vi.fn();

function setupDefaultMocks() {
  useAiPostGenerationModelsMock.mockImplementation((params?: { page?: number }) => ({
    data: params?.page === 2 ? MODELS_RESPONSE_PAGE_2 : MODELS_RESPONSE,
    isLoading: false,
    isFetching: false,
    isError: false,
  }));
  useUpdateAiPostGenerationConfigMock.mockReturnValue({ mutate: muteMock, isPending: false });
  getAiPostGenerationModelsMock.mockResolvedValue(MODELS_RESPONSE);
  fetchQueryMock.mockImplementation(({ queryFn }: { queryFn: () => Promise<unknown> }) =>
    queryFn()
  );
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

  it('renders provider, description, pricing, and current admin metadata for saved models', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: READY_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    expect(screen.getAllByText(/openai/i).length).toBeGreaterThan(0);
    expect(
      screen.getAllByText(/Modelo multimodal da OpenAI com boa aderência a JSON schema/i).length
    ).toBeGreaterThan(0);
    expect(screen.getAllByText(/Entrada US\$/i).length).toBeGreaterThan(0);
    expect(screen.getByText(/Atualizado por admin/i)).toBeInTheDocument();
    expect(screen.getByText(/Tópicos ativos/i)).toBeInTheDocument();
    expect(screen.getByText(/Rascunho ativo/i)).toBeInTheDocument();
  });

  it('supports pagination for the topic selector', async () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: READY_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: 'Modelo de tópicos: próxima página' }));

    await waitFor(() => {
      expect(
        useAiPostGenerationModelsMock.mock.calls.some(
          ([params]) => params?.page === 2 && params?.perPage === 8
        )
      ).toBe(true);
    });
    expect(screen.getByText('Gemini 2.5 Pro')).toBeInTheDocument();
  });

  it('forces a catalog refresh when the refresh button is clicked', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);

    useAiPostGenerationConfigMock.mockReturnValue({
      data: READY_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /Atualizar catálogo/i }));

    await waitFor(() => {
      expect(fetchQueryMock).toHaveBeenCalledTimes(2);
    });
    expect(getAiPostGenerationModelsMock).toHaveBeenCalledWith(
      expect.objectContaining({ page: 1, perPage: 8, forceRefresh: true })
    );
    expect(refetchMock).toHaveBeenCalledOnce();
  });

  it('revalidates config status even when a catalog refresh request fails', async () => {
    const refetchMock = vi.fn().mockResolvedValue(undefined);

    useAiPostGenerationConfigMock.mockReturnValue({
      data: CATALOG_UNAVAILABLE_STATE,
      isLoading: false,
      isError: false,
      refetch: refetchMock,
    });
    fetchQueryMock
      .mockRejectedValueOnce(new Error('catalog down'))
      .mockResolvedValueOnce(MODELS_RESPONSE);

    renderPanel();

    fireEvent.click(screen.getByRole('button', { name: /Atualizar catálogo/i }));

    await waitFor(() => {
      expect(fetchQueryMock).toHaveBeenCalledTimes(2);
      expect(refetchMock).toHaveBeenCalledOnce();
    });
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

  it('shows a catalog load error and disables saving when model queries fail', () => {
    useAiPostGenerationConfigMock.mockReturnValue({
      data: READY_CONFIG_STATE,
      isLoading: false,
      isError: false,
      refetch: vi.fn(),
    });
    useAiPostGenerationModelsMock.mockReturnValue({
      data: undefined,
      isLoading: false,
      isFetching: false,
      isError: true,
    });

    renderPanel();

    expect(
      screen.getByText(/Não foi possível carregar a listagem de modelos/i)
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Salvar configuração/i })).toBeDisabled();
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
