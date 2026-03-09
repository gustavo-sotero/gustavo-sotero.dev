/**
 * Tests for TechIcon — icon resolution and fallback logic.
 *
 * Covers:
 *  - `si:SiGit` renders an SVG (regression guard for the added icon)
 *  - Known si: icons (TypeScript, Bun) render SVG elements
 *  - Known lucide: icons render SVG elements
 *  - Unknown si: key falls back to Badge text
 *  - Unknown lucide: key falls back to Badge text
 *  - null/undefined iconKey with name falls back to Badge text
 *  - null/undefined iconKey without name renders nothing
 */
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { SUPPORTED_SI_KEYS, TechIcon } from './TechIcon';

afterEach(cleanup);

describe('TechIcon — si: prefix', () => {
  it('renders an SVG for si:SiGit (regression guard)', () => {
    const { container } = render(<TechIcon iconKey="si:SiGit" name="Git" />);
    // SVG element is rendered — the icon resolved correctly
    expect(container.querySelector('svg')).not.toBeNull();
    // The text 'Git' only appears inside the SVG <title>, not as a visible badge fallback
    const badge = container.querySelector('[data-slot="badge"]');
    expect(badge).toBeNull();
  });

  it('renders an SVG for si:SiTypescript', () => {
    const { container } = render(<TechIcon iconKey="si:SiTypescript" name="TypeScript" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders an SVG for si:SiBun', () => {
    const { container } = render(<TechIcon iconKey="si:SiBun" name="Bun" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('falls back to Badge text for unknown si: key', () => {
    render(<TechIcon iconKey="si:SiInexistente" name="Inexistente" />);
    expect(screen.getByText('Inexistente')).toBeInTheDocument();
  });
});

describe('TechIcon — lucide: prefix', () => {
  it('renders an SVG for lucide:Database', () => {
    const { container } = render(<TechIcon iconKey="lucide:Database" name="Database" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('falls back to Badge text for unknown lucide: key', () => {
    render(<TechIcon iconKey="lucide:Inexistente" name="Inexistente" />);
    expect(screen.getByText('Inexistente')).toBeInTheDocument();
  });
});

describe('TechIcon — null/undefined iconKey', () => {
  it('shows Badge with name when iconKey is null', () => {
    render(<TechIcon iconKey={null} name="MyTool" />);
    expect(screen.getByText('MyTool')).toBeInTheDocument();
  });

  it('shows Badge with name when iconKey is undefined', () => {
    render(<TechIcon iconKey={undefined} name="MyTool" />);
    expect(screen.getByText('MyTool')).toBeInTheDocument();
  });

  it('renders nothing when iconKey is null and no name is given', () => {
    const { container } = render(<TechIcon iconKey={null} />);
    expect(container.firstChild).toBeNull();
  });
});

describe('SUPPORTED_SI_KEYS export', () => {
  it('includes SiGit', () => {
    expect(SUPPORTED_SI_KEYS.has('SiGit')).toBe(true);
  });

  it('includes SiTypescript', () => {
    expect(SUPPORTED_SI_KEYS.has('SiTypescript')).toBe(true);
  });

  it('does not include an invented key', () => {
    expect(SUPPORTED_SI_KEYS.has('SiInexistente')).toBe(false);
  });
});

describe('TechIcon — category default icon', () => {
  it('renders an SVG (not Badge) when iconKey is null and category is provided', () => {
    const { container } = render(<TechIcon iconKey={null} category="language" name="MyLang" />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
  });

  it('renders an SVG when iconKey is undefined and category is provided', () => {
    const { container } = render(<TechIcon iconKey={undefined} category="tool" />);
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('renders SVG when iconKey is unresolvable but category is provided', () => {
    const { container } = render(<TechIcon iconKey="si:SiUnknownXyz" category="db" name="MyDB" />);
    expect(container.querySelector('svg')).not.toBeNull();
    expect(container.querySelector('[data-slot="badge"]')).toBeNull();
  });

  it('renders a different SVG for each category (smoke test)', () => {
    const categories = ['language', 'framework', 'tool', 'db', 'cloud', 'infra', 'other'] as const;
    for (const cat of categories) {
      const { container } = render(<TechIcon iconKey={null} category={cat} />);
      expect(container.querySelector('svg')).not.toBeNull();
      cleanup();
    }
  });

  it('still falls back to Badge when no iconKey and no category but name is provided', () => {
    render(<TechIcon iconKey={null} name="FallbackTool" />);
    expect(screen.getByText('FallbackTool')).toBeInTheDocument();
  });

  it('still renders nothing when no iconKey, no category, and no name', () => {
    const { container } = render(<TechIcon iconKey={null} />);
    expect(container.firstChild).toBeNull();
  });
});
