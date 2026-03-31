import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ───────────────────────────────────────────────────────────────

vi.mock('lucide-react', () => ({
  AlertTriangle: () => <svg data-testid="alert-triangle-icon" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className: _c,
    variant: _v,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string }) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

// ── Subject under test ────────────────────────────────────────────────────────

import AppError from './error';

// ── Tests ─────────────────────────────────────────────────────────────────────

const makeError = (msg = 'test error'): Error & { digest?: string } =>
  Object.assign(new Error(msg), { digest: 'test-digest' });

describe('AppError (public error boundary)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the error heading', () => {
    render(<AppError error={makeError()} unstable_retry={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /algo deu errado/i })).toBeDefined();
  });

  it('renders a safe description without exposing the internal error message', () => {
    render(<AppError error={makeError('sensitive internal detail')} unstable_retry={vi.fn()} />);

    expect(screen.queryByText(/sensitive internal detail/i)).toBeNull();
    expect(screen.getByText(/tente novamente ou volte mais tarde/i)).toBeDefined();
  });

  it('calls unstable_retry when the retry button is clicked', () => {
    const unstable_retry = vi.fn();
    render(<AppError error={makeError()} unstable_retry={unstable_retry} />);

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(unstable_retry).toHaveBeenCalledOnce();
  });

  it('logs the error to console.error via useEffect', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = makeError('boundary test');
    render(<AppError error={error} unstable_retry={vi.fn()} />);

    expect(consoleError).toHaveBeenCalledWith('[boundary:public]', error);
  });

  it('renders the alert icon', () => {
    render(<AppError error={makeError()} unstable_retry={vi.fn()} />);

    expect(screen.getByTestId('alert-triangle-icon')).toBeDefined();
  });
});
