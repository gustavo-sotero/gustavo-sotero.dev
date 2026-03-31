import { publicTagQuerySchema, tagQuerySchema } from '@portfolio/shared/schemas/tags';
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

describe('publicTagQuerySchema', () => {
  it('aceita source=project', () => {
    const parsed = publicTagQuerySchema.safeParse({ source: 'project' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.source).toBe('project');
  });

  it('aceita source=post', () => {
    const parsed = publicTagQuerySchema.safeParse({ source: 'post' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.source).toBe('post');
  });

  it('aceita source=experience', () => {
    const parsed = publicTagQuerySchema.safeParse({ source: 'experience' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.source).toBe('experience');
  });

  it('rejeita source inválido', () => {
    const parsed = publicTagQuerySchema.safeParse({ source: 'admin' });
    expect(parsed.success).toBe(false);
  });

  it('aceita combinação category + source', () => {
    const parsed = publicTagQuerySchema.safeParse({
      category: 'language,framework',
      source: 'project',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.category).toBe('language,framework');
      expect(parsed.data.source).toBe('project');
    }
  });

  it('source ausente preserva comportamento padrão (undefined)', () => {
    const parsed = publicTagQuerySchema.safeParse({ category: 'tool' });
    expect(parsed.success).toBe(true);
    if (parsed.success) expect(parsed.data.source).toBeUndefined();
  });

  it('aceita query completamente vazia (sem source e sem category)', () => {
    const parsed = publicTagQuerySchema.safeParse({});
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.source).toBeUndefined();
      expect(parsed.data.category).toBeUndefined();
    }
  });
});
