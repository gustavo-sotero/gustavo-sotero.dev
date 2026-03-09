import { describe, expect, it } from 'vitest';
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
