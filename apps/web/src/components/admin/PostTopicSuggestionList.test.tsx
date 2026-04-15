import { fireEvent, render, screen } from '@testing-library/react';
import type React from 'react';
import { describe, expect, it, vi } from 'vitest';

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
  RefreshCcw: () => <span aria-hidden="true" />,
  Tag: () => <span aria-hidden="true" />,
}));

import { PostTopicSuggestionList } from './PostTopicSuggestionList';

const TOPIC = {
  suggestionId: 's1',
  category: 'backend-arquitetura' as const,
  proposedTitle: 'Fila não é solução mágica',
  angle: 'Trade-offs de filas em produção',
  summary: 'Por que fila resolve um problema e cria outros.',
  targetReader: 'Engenheiros backend com 2-5 anos',
  suggestedTagNames: ['BullMQ', 'Redis'],
  rationale: 'Tema recorrente que ajuda a filtrar hype de arquitetura.',
};

describe('PostTopicSuggestionList', () => {
  it('renders the full topic context required for selection', () => {
    render(
      <PostTopicSuggestionList
        topics={[TOPIC]}
        onSelect={vi.fn()}
        onRegenerate={vi.fn()}
        onReset={vi.fn()}
        isRegenerating={false}
      />
    );

    expect(screen.getByText(/Trade-offs de filas em produção/i)).toBeInTheDocument();
    expect(screen.getByText(/Engenheiros backend com 2-5 anos/i)).toBeInTheDocument();
    expect(screen.getByText(/Backend & Arquitetura/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Tema recorrente que ajuda a filtrar hype de arquitetura\./i)
    ).toBeInTheDocument();
  });

  it('calls the selection and navigation callbacks', () => {
    const onSelect = vi.fn();
    const onRegenerate = vi.fn();
    const onReset = vi.fn();

    render(
      <PostTopicSuggestionList
        topics={[TOPIC]}
        onSelect={onSelect}
        onRegenerate={onRegenerate}
        onReset={onReset}
        isRegenerating={false}
      />
    );

    fireEvent.click(screen.getByText(/Fila não é solução mágica/i));
    fireEvent.click(screen.getByRole('button', { name: /Outros temas/i }));
    fireEvent.click(screen.getByRole('button', { name: /Voltar/i }));

    expect(onSelect).toHaveBeenCalledWith(TOPIC);
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
  });
});
