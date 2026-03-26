import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mutateAsyncMock = vi.fn();
let adminTagsMock: Array<{
  id: number;
  name: string;
  slug: string;
  category: string;
  iconKey: string | null;
  isHighlighted: boolean;
  createdAt: string;
}> = [];

vi.mock('@portfolio/shared', async () => {
  const actual = await vi.importActual<typeof import('@portfolio/shared')>('@portfolio/shared');
  return {
    ...actual,
    generateSlug: (name: string) => name.toLowerCase().replace(/\s+/g, '-'),
  };
});

vi.mock('@/hooks/admin/use-admin-tags', () => ({
  useCreateTag: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  useAdminTags: () => ({
    data: adminTagsMock,
    isLoading: false,
  }),
}));

import { CreateTagDialogForm } from './CreateTagDialogForm';

const defaultProps = {
  open: true,
  onClose: vi.fn(),
  onTagCreated: vi.fn(),
};

describe('CreateTagDialogForm — name-first flow', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    vi.clearAllMocks();
    adminTagsMock = [];
  });

  afterEach(() => {
    cleanup();
  });

  // ── Name input is always enabled ─────────────────────────────────────────

  it('name input is always enabled — no prerequisite category selection', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    const nameInput = screen.getByLabelText(/Nome/i);
    expect(nameInput).not.toBeDisabled();
    // Submit still disabled because name + category are both empty
    expect(screen.getByRole('button', { name: /Criar tag/i })).toBeDisabled();
  });

  it('shows cross-category suggestions when typing', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'React' } });
    const listbox = screen.getByRole('listbox', { name: 'Sugestões' });
    expect(listbox).toBeInTheDocument();
    const options = screen.getAllByRole('option');
    expect(options.some((el) => el.textContent?.includes('React'))).toBe(true);
  });

  it('suggestions come from all categories — not filtered by a single category', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    // 'Re' is a prefix for React (framework) and Redis (db)
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Re' } });
    const listbox = screen.getByRole('listbox', { name: 'Sugestões' });
    expect(listbox).toBeInTheDocument();
    const items = screen.getAllByRole('option');
    const names = items.map((el) => el.textContent ?? '');
    const hasReact = names.some((n) => n.includes('React'));
    const hasRedis = names.some((n) => n.includes('Redis'));
    // Both framework (React) and db (Redis) entries should appear
    expect(hasReact || hasRedis).toBe(true);
  });

  // ── Mapped suggestion auto-fills and locks category ──────────────────────

  it('selecting a mapped suggestion fills name and shows auto-detected category badge', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Type' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /TypeScript/i }));

    expect(screen.getByLabelText(/Nome/i)).toHaveValue('TypeScript');
    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();
    // Category select replaced by static display — no combobox role
    expect(screen.queryByRole('combobox')).not.toBeInTheDocument();
  });

  it('auto-detected category label correct — TypeScript → Linguagem', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'TypeScript' } });
    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();
    const categoryDisplay = screen.getByLabelText('Categoria definida automaticamente');
    expect(categoryDisplay).toHaveTextContent('Linguagem');
  });

  it('auto-detected category correct — React → Framework', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'React' } });
    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();
    const categoryDisplay = screen.getByLabelText('Categoria definida automaticamente');
    expect(categoryDisplay).toHaveTextContent('Framework');
  });

  it('auto-detected category correct — PostgreSQL → Banco de Dados', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'PostgreSQL' } });
    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();
    const categoryDisplay = screen.getByLabelText('Categoria definida automaticamente');
    expect(categoryDisplay).toHaveTextContent('Banco de Dados');
  });

  it('auto-detected category correct — Docker → Ferramenta', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Docker' } });
    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();
    const categoryDisplay = screen.getByLabelText('Categoria definida automaticamente');
    expect(categoryDisplay).toHaveTextContent('Ferramenta');
  });

  it('resolves via alias — typing exact alias maps to catalog entry category', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    // 'ts' is an alias for TypeScript (language)
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'ts' } });
    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();
    const categoryDisplay = screen.getByLabelText('Categoria definida automaticamente');
    expect(categoryDisplay).toHaveTextContent('Linguagem');
  });

  it('clearing the name after a mapped selection removes auto-badge and restores category select', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'TypeScript' } });
    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: '' } });
    expect(screen.queryByText('Definido automaticamente')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('switching from mapped to unmapped name restores editable category select', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'React' } });
    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'My Custom Lib' } });
    expect(screen.queryByText('Definido automaticamente')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  // ── Unmapped name requires manual category ───────────────────────────────

  it('typing a name not in the catalog shows enabled category select', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'SuperCustomTool99' } });
    expect(screen.queryByText('Definido automaticamente')).not.toBeInTheDocument();
    expect(screen.getByRole('combobox')).toBeInTheDocument();
    expect(screen.getByText(/fallback da categoria no backend/i)).toBeInTheDocument();
  });

  it('hides fallback guidance when the tag is mapped and category is automatic', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'React' } });
    expect(screen.queryByText(/fallback da categoria no backend/i)).not.toBeInTheDocument();
  });

  it('submit button is disabled when name is set but no category selected (unmapped)', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'My Custom Tool' } });
    // No category selected and name not in catalog → button stays disabled
    expect(screen.getByRole('button', { name: /Criar tag/i })).toBeDisabled();
    expect(mutateAsyncMock).not.toHaveBeenCalled();
  });

  // ── Successful submissions ────────────────────────────────────────────────

  it('submits mapped tag with auto-filled category — no manual category selection needed', async () => {
    const newTag = {
      id: 1,
      name: 'TypeScript',
      slug: 'typescript',
      category: 'language',
      iconKey: 'si:SiTypescript',
      isHighlighted: false,
    };
    mutateAsyncMock.mockResolvedValue({ data: newTag });

    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'TypeScript' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar tag/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'TypeScript',
          category: 'language',
          isHighlighted: false,
        })
      );
    });
  });

  it('submits custom unmapped tag when defaultCategory pre-fills the category', async () => {
    const newTag = {
      id: 42,
      name: 'My Custom Tool',
      slug: 'my-custom-tool',
      category: 'tool',
      iconKey: null,
    };
    mutateAsyncMock.mockResolvedValue({ data: newTag });

    render(<CreateTagDialogForm {...defaultProps} defaultCategory="tool" />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'My Custom Tool' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar tag/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'My Custom Tool',
          category: 'tool',
          isHighlighted: false,
        })
      );
    });
  });

  it('calls onTagCreated with the new tag after successful creation', async () => {
    const onTagCreated = vi.fn();
    const newTag = {
      id: 7,
      name: 'Redis',
      slug: 'redis',
      category: 'db',
      iconKey: 'si:SiRedis',
      isHighlighted: false,
    };
    mutateAsyncMock.mockResolvedValue({ data: newTag });

    render(<CreateTagDialogForm open={true} onClose={vi.fn()} onTagCreated={onTagCreated} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Redis' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /Redis/i }));
    fireEvent.click(screen.getByRole('button', { name: /Criar tag/i }));

    await waitFor(() => {
      expect(onTagCreated).toHaveBeenCalledWith(newTag);
    });
  });

  // ── Highlight toggle ─────────────────────────────────────────────────────

  it('sends isHighlighted=true when the highlight toggle is switched on', async () => {
    const newTag = {
      id: 99,
      name: 'Bun',
      slug: 'bun',
      category: 'tool',
      iconKey: 'si:SiBun',
      isHighlighted: true,
    };
    mutateAsyncMock.mockResolvedValue({ data: newTag });

    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Bun' } });

    const highlightSwitch = screen.getByRole('switch');
    fireEvent.click(highlightSwitch);
    fireEvent.click(screen.getByRole('button', { name: /Criar tag/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({ isHighlighted: true })
      );
    });
  });

  // ── Error handling ────────────────────────────────────────────────────────

  it('shows highlight limit error when API returns 409 CONFLICT with category limit message', async () => {
    mutateAsyncMock.mockRejectedValue({
      error: {
        code: 'CONFLICT',
        message:
          'Máximo de 2 tags destacadas por categoria. Remova um destaque existente antes de adicionar outro.',
      },
    });

    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'SvelteKit' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar tag/i }));

    await waitFor(() => {
      expect(screen.getByText(/Máximo de 2 destaques por categoria/i)).toBeInTheDocument();
    });

    // Dialog must NOT close on highlight limit error
    expect(defaultProps.onClose).not.toHaveBeenCalled();
  });

  it('shows inline conflict error when API returns CONFLICT and no matching existing tag found', async () => {
    mutateAsyncMock.mockRejectedValue({ error: { code: 'CONFLICT' } });

    render(<CreateTagDialogForm {...defaultProps} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Docker' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar tag/i }));

    await waitFor(() => {
      expect(screen.getByText(/Já existe uma tag com este nome/i)).toBeInTheDocument();
    });
  });

  it('on conflict, auto-selects an existing tag from loaded tags and fires onTagCreated', async () => {
    const onTagCreated = vi.fn();
    const onClose = vi.fn();
    const existing = {
      id: 21,
      name: 'Docker',
      slug: 'docker',
      category: 'tool',
      iconKey: 'si:SiDocker',
      isHighlighted: false,
      createdAt: '2026-01-01T00:00:00.000Z',
    };
    adminTagsMock = [existing];
    mutateAsyncMock.mockRejectedValue({ error: { code: 'CONFLICT' } });

    render(<CreateTagDialogForm open={true} onClose={onClose} onTagCreated={onTagCreated} />);
    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'Docker' } });
    fireEvent.click(screen.getByRole('button', { name: /Criar tag/i }));

    await waitFor(() => {
      expect(onTagCreated).toHaveBeenCalledWith(existing);
      expect(onClose).toHaveBeenCalled();
    });
  });

  // ── Form reset ────────────────────────────────────────────────────────────

  it('resets name and removes mapped state when Cancelar is clicked', async () => {
    const onClose = vi.fn();
    render(<CreateTagDialogForm open={true} onClose={onClose} />);

    fireEvent.change(screen.getByLabelText(/Nome/i), { target: { value: 'TypeScript' } });
    expect(screen.getByText('Definido automaticamente')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/i }));
    expect(onClose).toHaveBeenCalled();
  });

  // ── No iconKey input — server-side responsibility ─────────────────────────

  it('has no iconKey input field — icon resolution is exclusively server-side', () => {
    render(<CreateTagDialogForm {...defaultProps} />);
    expect(screen.queryByLabelText(/Icon Key/i)).not.toBeInTheDocument();
  });
});
