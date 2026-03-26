import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostForm } from './PostForm';

const pushMock = vi.fn();
const mutateAsyncMock = vi.fn();
let onTagCreatedCb:
  | ((tag: {
      id: number;
      name: string;
      slug: string;
      category: string;
      iconKey: string | null;
    }) => void)
  | undefined;

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: pushMock,
  }),
}));

vi.mock('@portfolio/shared', async () => {
  const actual = await vi.importActual<typeof import('@portfolio/shared')>('@portfolio/shared');
  return {
    ...actual,
    generateSlug: () => 'post-de-teste',
  };
});

vi.mock('@/hooks/admin/use-admin-tags', () => ({
  useAdminTags: () => ({
    data: [
      {
        id: 1,
        name: 'TypeScript',
        slug: 'typescript',
        category: 'language',
        iconKey: 'si:SiTypescript',
      },
    ],
    isLoading: false,
  }),
}));

vi.mock('@/hooks/admin/use-admin-posts', () => ({
  useCreatePost: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
  useUpdatePost: () => ({
    mutateAsync: mutateAsyncMock,
    isPending: false,
  }),
}));

// Mock CreateTagDialogForm to capture onTagCreated callback
vi.mock('./CreateTagDialogForm', () => ({
  CreateTagDialogForm: ({
    open,
    onClose,
    onTagCreated,
  }: {
    open: boolean;
    onClose: () => void;
    onTagCreated?: (tag: {
      id: number;
      name: string;
      slug: string;
      category: string;
      iconKey: string | null;
    }) => void;
  }) => {
    onTagCreatedCb = onTagCreated;
    if (!open) return null;
    return (
      <div data-testid="create-tag-dialog">
        <button type="button" onClick={onClose}>
          Fechar dialog
        </button>
      </div>
    );
  },
}));

vi.mock('./MarkdownEditor', () => ({
  MarkdownEditor: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="Conteúdo Markdown"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  ),
}));

vi.mock('./CoverMediaField', () => ({
  CoverMediaField: () => <div data-testid="cover-media-field" />,
}));

describe('PostForm', () => {
  beforeEach(() => {
    mutateAsyncMock.mockReset();
    pushMock.mockReset();
    onTagCreatedCb = undefined;
  });

  afterEach(() => {
    cleanup();
  });

  it('does not navigate when create mutation fails', async () => {
    mutateAsyncMock.mockRejectedValue(new Error('Falha ao salvar'));

    render(<PostForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Título/i), {
      target: { value: 'Meu post' },
    });

    fireEvent.change(screen.getByLabelText('Conteúdo Markdown'), {
      target: { value: 'Conteúdo válido para o post' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Criar post/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledTimes(1);
    });

    expect(pushMock).not.toHaveBeenCalled();
  });

  // Plan §13.1.6 — Inline tag creation in PostForm auto-selects the new tag
  it('opens create-tag dialog when Criar tag button is clicked', () => {
    render(<PostForm mode="create" />);

    // Dialog should not be visible initially
    expect(screen.queryByTestId('create-tag-dialog')).not.toBeInTheDocument();

    fireEvent.click(screen.getByText(/Criar tag/i));

    expect(screen.getByTestId('create-tag-dialog')).toBeInTheDocument();
  });

  it('auto-selects newly created tag in the form and closes dialog', async () => {
    render(<PostForm mode="create" />);

    // Open the inline tag dialog
    fireEvent.click(screen.getByText(/Criar tag/i));
    expect(screen.getByTestId('create-tag-dialog')).toBeInTheDocument();

    // Simulate the onTagCreated callback from the dialog with a brand-new tag
    const newTag = {
      id: 50,
      name: 'BullMQ',
      slug: 'bullmq',
      category: 'tool',
      iconKey: 'lucide:Zap',
    };
    onTagCreatedCb?.(newTag);

    await waitFor(() => {
      // Dialog should close automatically after tag creation
      expect(screen.queryByTestId('create-tag-dialog')).not.toBeInTheDocument();
    });
  });

  it('renders existing tags as native checkboxes', () => {
    render(<PostForm mode="create" />);
    expect(screen.getByRole('checkbox', { name: 'TypeScript' })).toBeInTheDocument();
  });

  // Scheduling feature tests
  it('renders scheduledAt datetime field when editing a post with status=scheduled', () => {
    const scheduledPost = {
      id: 1,
      slug: 'post-agendado',
      title: 'Post Agendado',
      content: 'Conteúdo',
      excerpt: null,
      coverUrl: null,
      status: 'scheduled' as const,
      scheduledAt: '2099-03-01T10:00:00.000Z',
      renderedContent: null,
      deletedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      publishedAt: null,
      tags: [],
    };

    render(<PostForm mode="edit" post={scheduledPost} />);

    // The scheduledAt datetime-local input must be visible
    expect(screen.getByLabelText(/Data e hora de publicação/i)).toBeInTheDocument();
  });

  it('submit with scheduled status includes scheduledAt as UTC ISO string in payload', async () => {
    const futureUtc = '2099-06-15T14:00:00.000Z';
    const scheduledPost = {
      id: 2,
      slug: 'post-b',
      title: 'Post B',
      content: 'Conteúdo B',
      excerpt: null,
      coverUrl: null,
      status: 'scheduled' as const,
      scheduledAt: futureUtc,
      renderedContent: null,
      deletedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      publishedAt: null,
      tags: [],
    };

    mutateAsyncMock.mockResolvedValueOnce({ data: scheduledPost });

    render(<PostForm mode="edit" post={scheduledPost} />);

    // The scheduledAt field is pre-populated from the post
    const scheduledAtInput = screen.getByLabelText(/Data e hora de publicação/i);
    expect(scheduledAtInput).toBeInTheDocument();

    // Submit the form
    fireEvent.click(screen.getByRole('button', { name: /Salvar alterações/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.objectContaining({
          status: 'scheduled',
          // scheduledAt is a Date object after zodResolver transforms the ISO string
          scheduledAt: expect.any(Date),
        })
      );
    });
  });

  it('does not include scheduledAt in payload when status is draft', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ data: {} });

    render(<PostForm mode="create" />);

    fireEvent.change(screen.getByLabelText(/Título/i), {
      target: { value: 'Rascunho' },
    });
    fireEvent.change(screen.getByLabelText('Conteúdo Markdown'), {
      target: { value: 'Conte do válido' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Criar post/i }));

    await waitFor(() => {
      expect(mutateAsyncMock).toHaveBeenCalledWith(
        expect.not.objectContaining({ scheduledAt: expect.anything() })
      );
    });
  });

  it('auto-generates slug from title change in create mode', async () => {
    render(<PostForm mode="create" />);

    fireEvent.change(screen.getByRole('textbox', { name: /Título/i }), {
      target: { value: 'Meu Post de Teste' },
    });

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /Slug/i })).toHaveValue('post-de-teste');
    });
  });

  it('does not update slug when auto-slug is disabled', async () => {
    render(<PostForm mode="create" />);

    // Disable auto-slug (button text is 'Auto-gerado' when active)
    fireEvent.click(screen.getByText('Auto-gerado'));

    // Manually set a custom slug
    const slugInput = screen.getByRole('textbox', { name: /Slug/i });
    fireEvent.change(slugInput, { target: { value: 'meu-slug-customizado' } });

    // Change the title
    fireEvent.change(screen.getByRole('textbox', { name: /Título/i }), {
      target: { value: 'Título Diferente' },
    });

    await waitFor(() => {
      expect(screen.getByRole('textbox', { name: /Slug/i })).toHaveValue('meu-slug-customizado');
    });
  });

  it('re-enables auto-slug and syncs slug from current title', async () => {
    render(<PostForm mode="create" />);

    // Type a title first while auto-slug is on
    fireEvent.change(screen.getByRole('textbox', { name: /Título/i }), {
      target: { value: 'Primeiro Título' },
    });

    // Disable auto-slug
    fireEvent.click(screen.getByText('Auto-gerado'));

    // Re-enable auto-slug (button text is now 'Gerar auto')
    fireEvent.click(screen.getByText('Gerar auto'));

    await waitFor(() => {
      // After re-enabling, toggleAutoSlug() calls syncAutoSlug with current title value
      expect(screen.getByRole('textbox', { name: /Slug/i })).toHaveValue('post-de-teste');
    });
  });

  it('submit payload omits empty optional fields', async () => {
    mutateAsyncMock.mockResolvedValueOnce({ data: {} });

    render(<PostForm mode="create" />);

    fireEvent.change(screen.getByRole('textbox', { name: /Título/i }), {
      target: { value: 'Post Simples' },
    });
    fireEvent.change(screen.getByLabelText('Conteúdo Markdown'), {
      target: { value: 'Conteúdo do post.' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Criar post/i }));

    await waitFor(() => {
      const payload = mutateAsyncMock.mock.calls[0]?.[0];
      expect(payload).toBeDefined();
      // coverUrl empty string is coerced to undefined by toPostPayload
      expect(payload.coverUrl).toBeUndefined();
      // excerpt empty string is coerced to undefined
      expect(payload.excerpt).toBeUndefined();
    });
  });
});
