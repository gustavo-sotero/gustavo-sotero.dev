import { describe, expect, it } from 'vitest';
import { ensureUniqueSlug, generateSlug } from './slug';

describe('slug utils', () => {
  it('normaliza acentos, espaços e caracteres inválidos', () => {
    expect(generateSlug('Olá Mundo!')).toBe('ola-mundo');
    expect(generateSlug('React___TypeScript 101')).toBe('react-typescript-101');
  });

  it('retorna fallback quando slug ficaria vazio', () => {
    expect(generateSlug('!!!')).toBe('item');
  });

  it('gera sufixo numérico quando há colisão', async () => {
    const taken = new Set(['post', 'post-1']);

    const unique = await ensureUniqueSlug('post', async (candidate) => taken.has(candidate));

    expect(unique).toBe('post-2');
  });
});
