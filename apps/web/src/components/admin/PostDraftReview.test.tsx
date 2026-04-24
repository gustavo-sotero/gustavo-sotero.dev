import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../ui/button', () => ({
  Button: ({ children, ...props }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button {...props}>{children}</button>
  ),
}));

vi.mock('../ui/badge', () => ({
  Badge: ({ children, ...props }: React.HTMLAttributes<HTMLSpanElement>) => (
    <span {...props}>{children}</span>
  ),
}));

vi.mock('lucide-react', () => ({
  ArrowLeft: () => <span aria-hidden="true" />,
  Check: () => <span aria-hidden="true" />,
  Clipboard: () => <span aria-hidden="true" />,
  ClipboardCheck: () => <span aria-hidden="true" />,
  RefreshCcw: () => <span aria-hidden="true" />,
  Wand2: () => <span aria-hidden="true" />,
}));

import { toast } from 'sonner';
import { PostDraftReview } from './PostDraftReview';

const TAGS = [
  {
    id: 1,
    name: 'TypeScript',
    slug: 'typescript',
    category: 'language' as const,
    iconKey: null,
    isHighlighted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
  {
    id: 2,
    name: 'Arquitetura Assíncrona',
    slug: 'arquitetura-assincrona',
    category: 'other' as const,
    iconKey: null,
    isHighlighted: false,
    createdAt: '2026-01-01T00:00:00.000Z',
  },
];

const DRAFT = {
  title: 'Post Gerado',
  slug: 'post-gerado',
  excerpt: 'Resumo curto.',
  content:
    '## Introdução\n\nConteúdo suficientemente longo para renderizar o preview com contexto real no review do draft.',
  suggestedTagNames: ['TypeScript', 'Redis'],
  imagePrompt: 'Minimalist dark illustration',
  linkedinPost:
    'Post sobre TypeScript e Redis. https://gustavo-sotero.dev/blog/post-gerado\n\n#TypeScript #Redis #Nodejs',
  notes: null,
};

const DRAFT_WITH_DUPLICATE_TAG_MATCHES = {
  ...DRAFT,
  suggestedTagNames: ['TypeScript', 'typescript', 'Redis'],
};

const DRAFT_WITH_SLUG_VARIANT_TAG = {
  ...DRAFT,
  suggestedTagNames: ['Arquitetura Assincrona'],
};

const DRAFT_WITH_MERMAID_CONTENT = {
  ...DRAFT,
  content:
    '## Fluxo\n\n```mermaid\ngraph TD\n  A[API] --> B[Worker]\n```\n\nConteúdo adicional para manter o markdown bruto durante a aplicação por campo.',
};

describe('PostDraftReview', () => {
  afterEach(() => {
    vi.clearAllMocks();
    cleanup();
  });

  it('applies the full draft payload with only matched tag IDs', async () => {
    const onApplyAll = vi.fn();

    render(
      <PostDraftReview
        draft={DRAFT}
        allTags={TAGS}
        currentValues={{}}
        onApplyAll={onApplyAll}
        onApplyField={vi.fn()}
        onRegenerate={vi.fn()}
        onBackToTopics={vi.fn()}
        onDiscard={vi.fn()}
        isRegenerating={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Aplicar tudo ao formulário/i }));

    await waitFor(() => {
      expect(onApplyAll).toHaveBeenCalledWith({
        title: DRAFT.title,
        slug: DRAFT.slug,
        excerpt: DRAFT.excerpt,
        content: DRAFT.content,
        tagIds: [1],
      });
      expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Draft aplicado ao formulário');
    });
  });

  it('applies only matched tag IDs and surfaces unmatched tag guidance', async () => {
    const onApplyField = vi.fn();

    render(
      <PostDraftReview
        draft={DRAFT}
        allTags={TAGS}
        currentValues={{}}
        onApplyAll={vi.fn()}
        onApplyField={onApplyField}
        onRegenerate={vi.fn()}
        onBackToTopics={vi.fn()}
        onDiscard={vi.fn()}
        isRegenerating={false}
      />
    );

    expect(
      screen.getByText(
        /Tags riscadas não existem no catálogo\. Crie-as manualmente para aplicar\./i
      )
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Aplicar tags/i }));

    await waitFor(() => {
      expect(onApplyField).toHaveBeenCalledWith('tagIds', [1]);
    });
  });

  it('deduplicates tag IDs when multiple suggested names resolve to the same catalog tag', async () => {
    const onApplyAll = vi.fn();
    const onApplyField = vi.fn();

    render(
      <PostDraftReview
        draft={DRAFT_WITH_DUPLICATE_TAG_MATCHES}
        allTags={TAGS}
        currentValues={{}}
        onApplyAll={onApplyAll}
        onApplyField={onApplyField}
        onRegenerate={vi.fn()}
        onBackToTopics={vi.fn()}
        onDiscard={vi.fn()}
        isRegenerating={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Aplicar tudo ao formulário/i }));
    await waitFor(() => {
      expect(onApplyAll).toHaveBeenCalledWith({
        title: DRAFT_WITH_DUPLICATE_TAG_MATCHES.title,
        slug: DRAFT_WITH_DUPLICATE_TAG_MATCHES.slug,
        excerpt: DRAFT_WITH_DUPLICATE_TAG_MATCHES.excerpt,
        content: DRAFT_WITH_DUPLICATE_TAG_MATCHES.content,
        tagIds: [1],
      });
    });

    fireEvent.click(screen.getByRole('button', { name: /Aplicar tags/i }));
    await waitFor(() => {
      expect(onApplyField).toHaveBeenCalledWith('tagIds', [1]);
    });
  });

  it('matches suggested tag names using shared slug normalization', async () => {
    const onApplyField = vi.fn();

    render(
      <PostDraftReview
        draft={DRAFT_WITH_SLUG_VARIANT_TAG}
        allTags={TAGS}
        currentValues={{}}
        onApplyAll={vi.fn()}
        onApplyField={onApplyField}
        onRegenerate={vi.fn()}
        onBackToTopics={vi.fn()}
        onDiscard={vi.fn()}
        isRegenerating={false}
      />
    );

    expect(
      screen.queryByText(
        /Tags riscadas não existem no catálogo\. Crie-as manualmente para aplicar\./i
      )
    ).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Aplicar tags/i }));

    await waitFor(() => {
      expect(onApplyField).toHaveBeenCalledWith('tagIds', [2]);
    });
  });

  it('applies the generated markdown content field without altering mermaid blocks', () => {
    const onApplyField = vi.fn();

    render(
      <PostDraftReview
        draft={DRAFT_WITH_MERMAID_CONTENT}
        allTags={TAGS}
        currentValues={{}}
        onApplyAll={vi.fn()}
        onApplyField={onApplyField}
        onRegenerate={vi.fn()}
        onBackToTopics={vi.fn()}
        onDiscard={vi.fn()}
        isRegenerating={false}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /Aplicar conteúdo/i }));

    expect(onApplyField).toHaveBeenCalledWith('content', DRAFT_WITH_MERMAID_CONTENT.content);
  });

  it('warns when applying the draft would overwrite prefilled form fields', () => {
    render(
      <PostDraftReview
        draft={DRAFT}
        allTags={TAGS}
        currentValues={{
          title: 'Título manual',
          slug: '',
          excerpt: '',
          content: 'Conteúdo manual existente',
          tagIds: [999],
        }}
        onApplyAll={vi.fn()}
        onApplyField={vi.fn()}
        onRegenerate={vi.fn()}
        onBackToTopics={vi.fn()}
        onDiscard={vi.fn()}
        isRegenerating={false}
      />
    );

    expect(
      screen.getByText(/Aplicar tudo vai sobrescrever: título, conteúdo, tags\./i)
    ).toBeInTheDocument();
    expect(screen.getAllByText(/Substitui o valor atual do formulário\./i)).toHaveLength(2);
    expect(
      screen.getByText(/Aplicar tags substitui as tags atuais do formulário\./i)
    ).toBeInTheDocument();
  });

  it('does not show overwrite warnings when the current form already matches the draft', () => {
    render(
      <PostDraftReview
        draft={DRAFT}
        allTags={TAGS}
        currentValues={{
          title: 'Post Gerado',
          slug: 'post-gerado',
          excerpt: 'Resumo curto.',
          content: DRAFT.content,
          tagIds: [1],
        }}
        onApplyAll={vi.fn()}
        onApplyField={vi.fn()}
        onRegenerate={vi.fn()}
        onBackToTopics={vi.fn()}
        onDiscard={vi.fn()}
        isRegenerating={false}
      />
    );

    expect(screen.queryByText(/Aplicar tudo vai sobrescrever/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Substitui o valor atual do formulário\./i)).not.toBeInTheDocument();
  });

  it('renders a raw markdown preview and exposes an explicit discard action', () => {
    const onDiscard = vi.fn();

    render(
      <PostDraftReview
        draft={DRAFT}
        allTags={TAGS}
        currentValues={{}}
        onApplyAll={vi.fn()}
        onApplyField={vi.fn()}
        onRegenerate={vi.fn()}
        onBackToTopics={vi.fn()}
        onDiscard={onDiscard}
        isRegenerating={false}
      />
    );

    expect(screen.getByText(/Preview do conteúdo/i)).toBeInTheDocument();
    expect(screen.getByText((_, node) => node?.textContent === DRAFT.content)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /^Descartar$/i }));
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });

  it('copies the image prompt to the clipboard and shows feedback', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    render(
      <PostDraftReview
        draft={DRAFT}
        allTags={TAGS}
        currentValues={{}}
        onApplyAll={vi.fn()}
        onApplyField={vi.fn()}
        onRegenerate={vi.fn()}
        onBackToTopics={vi.fn()}
        onDiscard={vi.fn()}
        isRegenerating={false}
      />
    );

    // Two 'Copiar' buttons: index 0 = image prompt, index 1 = LinkedIn
    const copyButtons = screen.getAllByRole('button', { name: /^Copiar$/i });
    const imagePromptBtn = copyButtons.at(0);
    if (!imagePromptBtn) throw new Error('Expected image prompt copy button');
    fireEvent.click(imagePromptBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(DRAFT.imagePrompt);
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Prompt de imagem copiado');
    expect(screen.getByRole('button', { name: /^Copiado$/i })).toBeInTheDocument();
    expect(
      screen.getByText(
        /Use este prompt em um gerador externo\. Ele não preenche a capa automaticamente nem altera o coverUrl do post\./i
      )
    ).toBeInTheDocument();
  });

  it('copies the LinkedIn post text to the clipboard and shows feedback', async () => {
    const writeTextMock = vi.fn().mockResolvedValue(undefined);

    Object.defineProperty(global.navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeTextMock },
    });

    render(
      <PostDraftReview
        draft={DRAFT}
        allTags={TAGS}
        currentValues={{}}
        onApplyAll={vi.fn()}
        onApplyField={vi.fn()}
        onRegenerate={vi.fn()}
        onBackToTopics={vi.fn()}
        onDiscard={vi.fn()}
        isRegenerating={false}
      />
    );

    expect(screen.getByText(/Texto para LinkedIn/i)).toBeInTheDocument();

    // Two 'Copiar' buttons: index 0 = image prompt, index 1 = LinkedIn
    const copyButtons = screen.getAllByRole('button', { name: /^Copiar$/i });
    const linkedinBtn = copyButtons.at(1);
    if (!linkedinBtn) throw new Error('Expected LinkedIn copy button');
    fireEvent.click(linkedinBtn);

    await waitFor(() => {
      expect(writeTextMock).toHaveBeenCalledWith(DRAFT.linkedinPost);
    });
    expect(vi.mocked(toast.success)).toHaveBeenCalledWith('Texto para LinkedIn copiado');
    expect(
      screen.getByText(
        /Copie e cole diretamente no LinkedIn\. Não altera nenhum campo do formulário do post\./i
      )
    ).toBeInTheDocument();
  });

  describe('when resolveAiTags prop is provided', () => {
    it('shows "serão criadas automaticamente" message for unmatched tag names', () => {
      render(
        <PostDraftReview
          draft={DRAFT}
          allTags={TAGS}
          currentValues={{}}
          onApplyAll={vi.fn()}
          onApplyField={vi.fn()}
          onRegenerate={vi.fn()}
          onBackToTopics={vi.fn()}
          onDiscard={vi.fn()}
          isRegenerating={false}
          resolveAiTags={vi.fn().mockResolvedValue([])}
        />
      );

      expect(
        screen.getByText(/Tags riscadas serão criadas automaticamente ao aplicar\./i)
      ).toBeInTheDocument();
      // Manual creation guidance must NOT appear
      expect(screen.queryByText(/Crie-as manualmente para aplicar\./i)).not.toBeInTheDocument();
    });

    it('calls resolveAiTags with unmatched names then calls onApplyField with combined IDs', async () => {
      const onApplyField = vi.fn();
      const resolveAiTags = vi.fn().mockResolvedValue([99]);

      render(
        <PostDraftReview
          draft={DRAFT}
          allTags={TAGS}
          currentValues={{}}
          onApplyAll={vi.fn()}
          onApplyField={onApplyField}
          onRegenerate={vi.fn()}
          onBackToTopics={vi.fn()}
          onDiscard={vi.fn()}
          isRegenerating={false}
          resolveAiTags={resolveAiTags}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Aplicar tags/i }));

      await waitFor(() => {
        expect(resolveAiTags).toHaveBeenCalledWith(
          expect.arrayContaining(['Redis']) // unmatched name in DRAFT
        );
        expect(onApplyField).toHaveBeenCalledWith('tagIds', expect.arrayContaining([1, 99]));
      });
    });

    it('calls resolveAiTags with unmatched names then calls onApplyAll with combined IDs', async () => {
      const onApplyAll = vi.fn();
      const resolveAiTags = vi.fn().mockResolvedValue([99]);

      render(
        <PostDraftReview
          draft={DRAFT}
          allTags={TAGS}
          currentValues={{}}
          onApplyAll={onApplyAll}
          onApplyField={vi.fn()}
          onRegenerate={vi.fn()}
          onBackToTopics={vi.fn()}
          onDiscard={vi.fn()}
          isRegenerating={false}
          resolveAiTags={resolveAiTags}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Aplicar tudo ao formulário/i }));

      await waitFor(() => {
        expect(resolveAiTags).toHaveBeenCalled();
        expect(onApplyAll).toHaveBeenCalledWith(
          expect.objectContaining({ tagIds: expect.arrayContaining([1, 99]) })
        );
      });
    });

    it('shows toast error and does NOT call onApplyField when resolveAiTags throws', async () => {
      const onApplyField = vi.fn();
      const resolveAiTags = vi.fn().mockRejectedValue(new Error('Network error'));

      render(
        <PostDraftReview
          draft={DRAFT}
          allTags={TAGS}
          currentValues={{}}
          onApplyAll={vi.fn()}
          onApplyField={onApplyField}
          onRegenerate={vi.fn()}
          onBackToTopics={vi.fn()}
          onDiscard={vi.fn()}
          isRegenerating={false}
          resolveAiTags={resolveAiTags}
        />
      );

      fireEvent.click(screen.getByRole('button', { name: /Aplicar tags/i }));

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalled();
        expect(onApplyField).not.toHaveBeenCalled();
      });
    });
  });
});
