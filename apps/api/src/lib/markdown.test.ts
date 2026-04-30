import { describe, expect, it } from 'vitest';
import { ALLOWED_IFRAME_ORIGINS, iframeCspTokens } from './iframe-policy';
import { renderMarkdown } from './markdown';
import { renderCommentMarkdown } from './markdownComment';

describe('markdown pipeline', () => {
  it('remove scripts perigosos', { timeout: 15_000 }, async () => {
    const html = await renderMarkdown('Texto <script>alert(1)</script> fim');

    expect(html).not.toContain('<script');
    expect(html).toContain('Texto');
  });

  it('converte bloco mermaid em placeholder seguro', async () => {
    const source = ['```mermaid', 'graph TD', '  A-->B', '```'].join('\n');
    const html = await renderMarkdown(source);

    expect(html).toContain('class="mermaid"');
    expect(html).toContain('data-content="');
    expect(html).not.toContain('<pre');
    expect(html).not.toContain('<code class="language-mermaid"');
  });

  it('permite iframe apenas de domínios autorizados', async () => {
    const safe = await renderMarkdown(
      '<iframe src="https://www.youtube.com/embed/abc123" title="video"></iframe>'
    );
    const blocked = await renderMarkdown('<iframe src="https://evil.example/embed/x"></iframe>');

    expect(safe).toContain('<iframe');
    expect(blocked).not.toContain('<iframe');
  });

  it('remove estilo inline arbitrário em HTML editorial', async () => {
    const html = await renderMarkdown('<p style="position:fixed;color:red">Texto</p>');

    expect(html).toContain('<p>Texto</p>');
    expect(html).not.toContain('position:fixed');
  });

  it('bloqueia iframe com protocolo inválido mesmo em domínio permitido', async () => {
    const html = await renderMarkdown(
      '<iframe src="javascript://www.youtube.com/embed/abc123" title="video"></iframe>'
    );

    expect(html).not.toContain('<iframe');
  });

  it('pipeline de comentário remove imagens e links javascript', async () => {
    const html = await renderCommentMarkdown(
      '![x](https://img.test/x.png) [bad](javascript:alert(1)) [mail](mailto:test@example.com) [ok](https://example.com)'
    );

    expect(html).not.toContain('<img');
    expect(html).not.toContain('javascript:');
    expect(html).not.toContain('mailto:');
    expect(html).toContain('nofollow ugc noreferrer');
    expect(html).toContain('target="_blank"');
  });

  it('renderiza tabela GFM em HTML', async () => {
    const source = ['| Coluna | Valor |', '| --- | --- |', '| A | 1 |'].join('\n');
    const html = await renderMarkdown(source);

    expect(html).toContain('<table>');
    expect(html).toContain('<thead>');
    expect(html).toContain('<tbody>');
  });

  it('aplica saída Shiki com variáveis de tema light/dark', async () => {
    const source = ['```ts', 'const valor = 1;', '```'].join('\n');
    const html = await renderMarkdown(source);

    expect(html).toContain('class="shiki shiki-themes github-light github-dark"');
    expect(html).toContain('--shiki-dark');
  });
});

describe('iframe policy parity (sanitization ↔ CSP)', () => {
  it('ALLOWED_IFRAME_ORIGINS and iframeCspTokens() are derived from the same list', () => {
    const tokens = iframeCspTokens();
    // Every CSP token must correspond to an allowed origin (with trailing slash added back)
    for (const token of tokens) {
      expect(ALLOWED_IFRAME_ORIGINS).toContain(`${token}/`);
    }
    // Every allowed origin must produce a CSP token
    expect(tokens).toHaveLength(ALLOWED_IFRAME_ORIGINS.length);
  });

  it('youtube-nocookie embed is rendered by sanitization pipeline', async () => {
    const html = await renderMarkdown(
      '<iframe src="https://www.youtube-nocookie.com/embed/abc" title="video"></iframe>'
    );
    expect(html).toContain('<iframe');
    expect(html).toContain('youtube-nocookie.com');
  });

  it('youtube embed is rendered by sanitization pipeline', async () => {
    const html = await renderMarkdown(
      '<iframe src="https://www.youtube.com/embed/abc" title="video"></iframe>'
    );
    expect(html).toContain('<iframe');
  });

  it('vimeo embed is rendered by sanitization pipeline', async () => {
    const html = await renderMarkdown(
      '<iframe src="https://player.vimeo.com/video/123" title="video"></iframe>'
    );
    expect(html).toContain('<iframe');
  });

  it('all allowed origins in ALLOWED_IFRAME_ORIGINS are present in iframeCspTokens output', () => {
    const tokens = iframeCspTokens();
    for (const origin of ALLOWED_IFRAME_ORIGINS) {
      const tokenForOrigin = origin.replace(/\/$/, '');
      expect(tokens).toContain(tokenForOrigin);
    }
  });
});
