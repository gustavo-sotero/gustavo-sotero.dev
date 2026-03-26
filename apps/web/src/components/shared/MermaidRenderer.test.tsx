import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/client-logger', () => ({
  logClientError: vi.fn(),
}));

// Lazily evaluated mermaid mock so each test can control its behaviour.
let mermaidRunImpl: (opts: { nodes: Element[] }) => Promise<void> = () => Promise.resolve();

vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    run: (opts: { nodes: Element[] }) => mermaidRunImpl(opts),
  },
}));

import { MermaidRenderer } from './MermaidRenderer';

// Minimal HTML that matches what the backend generates: a div with class="mermaid"
// and a base64-encoded diagram in data-content.
const DIAGRAM_SOURCE = 'graph TD; A-->B;';
const ENCODED = btoa(DIAGRAM_SOURCE);
const HTML_WITH_MERMAID = `<div class="mermaid" data-content="${ENCODED}"></div>`;
const HTML_WITHOUT_MERMAID = '<p>No diagrams here.</p>';

describe('MermaidRenderer', () => {
  beforeEach(() => {
    // Default: render succeeds without error
    mermaidRunImpl = () => Promise.resolve();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('renders the HTML without a fallback notice when mermaid.run succeeds', async () => {
    await act(async () => {
      render(<MermaidRenderer html={HTML_WITH_MERMAID} />);
    });

    // Wait a tick for the async effect to settle
    await act(async () => {});

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('does not show a fallback notice when there are no mermaid nodes', async () => {
    await act(async () => {
      render(<MermaidRenderer html={HTML_WITHOUT_MERMAID} />);
    });

    await act(async () => {});

    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows the fallback alert when mermaid.run rejects', async () => {
    mermaidRunImpl = () => Promise.reject(new Error('render failed'));

    render(<MermaidRenderer html={HTML_WITH_MERMAID} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('shows the fallback alert when the mermaid dynamic import fails', async () => {
    vi.doMock('mermaid', () => {
      throw new Error('module not found');
    });

    // Re-import to pick up the broken mock — we simulate the load error path
    // by making run throw immediately (the import-level throw is caught by
    // the .catch path in the component, which sets renderError=true).
    mermaidRunImpl = () => {
      throw new Error('module not found');
    };

    render(<MermaidRenderer html={HTML_WITH_MERMAID} />);

    await waitFor(() => {
      expect(screen.getByRole('alert')).toBeInTheDocument();
    });
  });

  it('renders the fallback alert with accessible role=alert', async () => {
    mermaidRunImpl = () => Promise.reject(new Error('bad diagram'));

    render(<MermaidRenderer html={HTML_WITH_MERMAID} />);

    await waitFor(() => {
      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      // The fallback should describe the problem to the reader
      expect(alert.textContent).toBeTruthy();
    });
  });
});
