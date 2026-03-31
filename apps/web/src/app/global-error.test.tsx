import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// ── Module mocks ───────────────────────────────────────────────────────────────

// global-error.tsx imports globals.css and fonts.ts at module scope.
// Both must be stubbed so that the test runs without requiring the full
// Next.js build pipeline (CSS processing, font loading).
vi.mock('./globals.css', () => ({}));

vi.mock('./fonts', () => ({
  sora: { variable: '--font-sora', className: 'sora' },
  jetbrainsMono: { variable: '--font-mono-jetbrains', className: 'jetbrains-mono' },
}));

vi.mock('lucide-react', () => ({
  AlertTriangle: () => <svg data-testid="alert-triangle-icon" />,
}));

vi.mock('@/components/ui/button', () => ({
  Button: ({
    children,
    onClick,
    className: _c,
    ...rest
  }: React.ButtonHTMLAttributes<HTMLButtonElement>) => (
    <button type="button" onClick={onClick} {...rest}>
      {children}
    </button>
  ),
}));

// ── Subject under test ────────────────────────────────────────────────────────

import GlobalError from './global-error';

// ── Tests ─────────────────────────────────────────────────────────────────────

const makeError = (msg = 'global test error'): Error & { digest?: string } =>
  Object.assign(new Error(msg), { digest: 'global-digest' });

describe('GlobalError (root boundary)', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renders the critical error heading', () => {
    render(<GlobalError error={makeError()} unstable_retry={vi.fn()} />);

    expect(screen.getByRole('heading', { name: /erro crítico/i })).toBeDefined();
  });

  it('renders a safe description without exposing internal details', () => {
    render(<GlobalError error={makeError('sensitive detail')} unstable_retry={vi.fn()} />);

    expect(screen.queryByText(/sensitive detail/i)).toBeNull();
    expect(screen.getByText(/erro inesperado/i)).toBeDefined();
  });

  it('calls unstable_retry when the retry button is clicked', () => {
    const unstable_retry = vi.fn();
    render(<GlobalError error={makeError()} unstable_retry={unstable_retry} />);

    fireEvent.click(screen.getByRole('button', { name: /tentar novamente/i }));

    expect(unstable_retry).toHaveBeenCalledOnce();
  });

  it('logs the error to console.error via useEffect', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = makeError('log-check');
    render(<GlobalError error={error} unstable_retry={vi.fn()} />);

    expect(consoleError).toHaveBeenCalledWith('[boundary:global]', error);
  });

  it('shows the 500 status code', () => {
    render(<GlobalError error={makeError()} unstable_retry={vi.fn()} />);

    expect(screen.getByText('500')).toBeDefined();
  });
});
