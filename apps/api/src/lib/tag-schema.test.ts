import { tagQuerySchema } from '@portfolio/shared/schemas/tags';
import { describe, expect, it } from 'vitest';

describe('tagQuerySchema', () => {
  it('aceita categorias válidas separadas por vírgula', () => {
    const parsed = tagQuerySchema.safeParse({ category: 'language,framework,db' });
    expect(parsed.success).toBe(true);
  });

  it('aceita as novas categorias cloud e infra', () => {
    const parsed = tagQuerySchema.safeParse({ category: 'cloud,infra' });
    expect(parsed.success).toBe(true);
  });

  it('aceita categoria cloud isolada', () => {
    const parsed = tagQuerySchema.safeParse({ category: 'cloud' });
    expect(parsed.success).toBe(true);
  });

  it('aceita categoria infra isolada', () => {
    const parsed = tagQuerySchema.safeParse({ category: 'infra' });
    expect(parsed.success).toBe(true);
  });

  it('aceita todas as categorias juntas', () => {
    const parsed = tagQuerySchema.safeParse({
      category: 'language,framework,tool,db,cloud,infra,other',
    });
    expect(parsed.success).toBe(true);
  });

  it('rejeita categoria inválida', () => {
    const parsed = tagQuerySchema.safeParse({ category: 'language,invalid' });
    expect(parsed.success).toBe(false);
  });

  it('rejeita mistura de válida e inválida incluindo novas categorias', () => {
    const parsed = tagQuerySchema.safeParse({ category: 'cloud,unknown' });
    expect(parsed.success).toBe(false);
  });
});
