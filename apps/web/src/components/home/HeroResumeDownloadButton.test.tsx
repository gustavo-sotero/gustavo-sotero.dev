import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('lucide-react', () => ({
  Download: () => <span data-testid="icon-download" />,
}));

import { HeroResumeDownloadButton } from './HeroResumeDownloadButton';

describe('HeroResumeDownloadButton', () => {
  it('renders an immediate download link without waiting for hydration', () => {
    const markup = renderToStaticMarkup(<HeroResumeDownloadButton />);

    expect(markup).toContain('href="/curriculo.pdf"');
    expect(markup).toContain('download=""');
    expect(markup).toContain('aria-label="Baixar currículo em PDF"');
    expect(markup).toContain('data-testid="icon-download"');
  });
});
