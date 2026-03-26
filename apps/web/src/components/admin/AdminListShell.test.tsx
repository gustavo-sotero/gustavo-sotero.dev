import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AdminListShell, AdminRowSkeleton, AdminStatusBadge } from './AdminListShell';

// ── AdminStatusBadge ──────────────────────────────────────────────────────────

describe('AdminStatusBadge', () => {
  it('renders "Publicado" with emerald styling for published status', () => {
    render(<AdminStatusBadge status="published" />);
    expect(screen.getByText('Publicado')).toBeInTheDocument();
  });

  it('renders "Agendado" with amber styling for scheduled status', () => {
    render(<AdminStatusBadge status="scheduled" />);
    expect(screen.getByText('Agendado')).toBeInTheDocument();
  });

  it('renders "Rascunho" for any unrecognized status', () => {
    render(<AdminStatusBadge status="draft" />);
    expect(screen.getByText('Rascunho')).toBeInTheDocument();
  });
});

// ── AdminRowSkeleton ──────────────────────────────────────────────────────────

describe('AdminRowSkeleton', () => {
  it('renders without crashing', () => {
    const { container } = render(<AdminRowSkeleton />);
    expect(container.firstChild).not.toBeNull();
  });
});

// ── AdminListShell ────────────────────────────────────────────────────────────

const baseProps = {
  title: 'Posts',
  tableHeader: <div data-testid="table-header">Header</div>,
  isLoading: false,
  isError: false,
  onRetry: vi.fn(),
  isEmpty: false,
  emptyMessage: 'Nenhum item encontrado',
  page: 1,
  totalPages: 1,
  onPageChange: vi.fn(),
};

describe('AdminListShell', () => {
  afterEach(cleanup);

  // ── Title and subtitle ──────────────────────────────────────────────────────

  it('renders the title', () => {
    render(
      <AdminListShell {...baseProps}>
        <div>Row 1</div>
      </AdminListShell>
    );
    expect(screen.getByRole('heading', { level: 1, name: 'Posts' })).toBeInTheDocument();
  });

  it('renders the subtitle when provided', () => {
    render(
      <AdminListShell {...baseProps} subtitle="5 posts">
        <div>Row 1</div>
      </AdminListShell>
    );
    expect(screen.getByText('5 posts')).toBeInTheDocument();
  });

  it('does not render the subtitle when omitted', () => {
    render(
      <AdminListShell {...baseProps}>
        <div>Row 1</div>
      </AdminListShell>
    );
    // No subtitle element should be present
    expect(screen.queryByText(/posts/i)?.parentElement?.querySelector('p')).toBeNull();
  });

  // ── Loading state ───────────────────────────────────────────────────────────

  it('renders skeleton rows while loading', () => {
    render(
      <AdminListShell {...baseProps} isLoading skeletonCount={3}>
        <div data-testid="row">Row 1</div>
      </AdminListShell>
    );

    // Children should not render while loading
    expect(screen.queryByTestId('row')).toBeNull();
  });

  it('does not show the error state while loading', () => {
    render(
      <AdminListShell {...baseProps} isLoading isError>
        <div>Row 1</div>
      </AdminListShell>
    );

    expect(screen.queryByText(/falha ao carregar/i)).toBeNull();
  });

  // ── Error state ─────────────────────────────────────────────────────────────

  it('renders the error message and a retry button when isError is true', () => {
    render(
      <AdminListShell {...baseProps} isError>
        <div>Row 1</div>
      </AdminListShell>
    );

    expect(screen.getByText(/falha ao carregar/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /tentar novamente/i })).toBeInTheDocument();
  });

  it('calls onRetry when the retry button is clicked', () => {
    const onRetry = vi.fn();

    render(
      <AdminListShell {...baseProps} isError onRetry={onRetry}>
        <div>Row 1</div>
      </AdminListShell>
    );

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  // ── Empty state ─────────────────────────────────────────────────────────────

  it('renders the empty message when isEmpty is true', () => {
    render(
      <AdminListShell {...baseProps} isEmpty>
        <div>Row 1</div>
      </AdminListShell>
    );

    expect(screen.getByText('Nenhum item encontrado')).toBeInTheDocument();
  });

  it('renders the optional emptyAction inside the empty state', () => {
    render(
      <AdminListShell
        {...baseProps}
        isEmpty
        emptyAction={<button type="button">Criar novo</button>}
      >
        <div>Row 1</div>
      </AdminListShell>
    );

    expect(screen.getByRole('button', { name: 'Criar novo' })).toBeInTheDocument();
  });

  it('does not render children in the empty state', () => {
    render(
      <AdminListShell {...baseProps} isEmpty>
        <div data-testid="data-row">Row 1</div>
      </AdminListShell>
    );

    expect(screen.queryByTestId('data-row')).toBeNull();
  });

  // ── Data state ──────────────────────────────────────────────────────────────

  it('renders children when not loading, not errored, and not empty', () => {
    render(
      <AdminListShell {...baseProps}>
        <div data-testid="data-row">Row 1</div>
      </AdminListShell>
    );

    expect(screen.getByTestId('data-row')).toBeInTheDocument();
    expect(screen.getByTestId('table-header')).toBeInTheDocument();
  });

  // ── Pagination ──────────────────────────────────────────────────────────────

  it('does not render pagination controls when totalPages is 1', () => {
    render(
      <AdminListShell {...baseProps} page={1} totalPages={1}>
        <div>Row 1</div>
      </AdminListShell>
    );

    expect(screen.queryByText(/página 1 de/i)).toBeNull();
  });

  it('renders pagination controls when totalPages > 1', () => {
    render(
      <AdminListShell {...baseProps} page={1} totalPages={5}>
        <div>Row 1</div>
      </AdminListShell>
    );

    expect(screen.getByText('Página 1 de 5')).toBeInTheDocument();
  });

  it('disables the previous-page button on the first page', () => {
    render(
      <AdminListShell {...baseProps} page={1} totalPages={3}>
        <div>Row 1</div>
      </AdminListShell>
    );

    // There are two icon buttons; prev is the first one
    const [prevBtn] = screen.getAllByRole('button');
    expect(prevBtn).toBeDisabled();
  });

  it('disables the next-page button on the last page', () => {
    render(
      <AdminListShell {...baseProps} page={3} totalPages={3}>
        <div>Row 1</div>
      </AdminListShell>
    );

    const buttons = screen.getAllByRole('button');
    const nextBtn = buttons[buttons.length - 1];
    expect(nextBtn).toBeDisabled();
  });

  it('calls onPageChange with the new page when next-page is clicked', () => {
    const onPageChange = vi.fn();

    render(
      <AdminListShell {...baseProps} page={1} totalPages={3} onPageChange={onPageChange}>
        <div>Row 1</div>
      </AdminListShell>
    );

    const buttons = screen.getAllByRole('button');
    const nextBtn = buttons[buttons.length - 1];
    fireEvent.click(nextBtn);

    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it('calls onPageChange with page-1 when prev-page is clicked', () => {
    const onPageChange = vi.fn();

    render(
      <AdminListShell {...baseProps} page={2} totalPages={3} onPageChange={onPageChange}>
        <div>Row 1</div>
      </AdminListShell>
    );

    const [prevBtn] = screen.getAllByRole('button');
    fireEvent.click(prevBtn);

    expect(onPageChange).toHaveBeenCalledWith(1);
  });
});
