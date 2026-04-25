import { describe, expect, it } from 'vitest';
import { createProjectSchema, updateProjectSchema } from './projects';

const validBase = {
  title: 'Projeto',
  status: 'draft' as const,
  featured: false,
  order: 0,
};

describe('project schemas', () => {
  describe('impactFacts validation', () => {
    it('accepts undefined (field is optional)', () => {
      const result = createProjectSchema.safeParse(validBase);
      expect(result.success).toBe(true);
    });

    it('accepts an empty array', () => {
      const result = createProjectSchema.safeParse({ ...validBase, impactFacts: [] });
      expect(result.success).toBe(true);
    });

    it('accepts a list of valid facts', () => {
      const result = createProjectSchema.safeParse({
        ...validBase,
        impactFacts: ['Reduziu latência em 40%', 'Adotado por +200 devs'],
      });
      expect(result.success).toBe(true);
    });

    it('accepts a qualitative fact (no number required)', () => {
      const result = createProjectSchema.safeParse({
        ...validBase,
        impactFacts: ['Migrou arquitetura de monolito para microserviços'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects a list with an empty string item', () => {
      const result = createProjectSchema.safeParse({
        ...validBase,
        impactFacts: ['Fato válido', ''],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'impactFacts')).toBe(true);
      }
    });

    it('rejects a list with a whitespace-only item', () => {
      const result = createProjectSchema.safeParse({
        ...validBase,
        impactFacts: ['   '],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'impactFacts')).toBe(true);
      }
    });

    it('rejects a list exceeding 6 items', () => {
      const result = createProjectSchema.safeParse({
        ...validBase,
        impactFacts: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'impactFacts')).toBe(true);
      }
    });

    it('accepts exactly 6 items (boundary)', () => {
      const result = createProjectSchema.safeParse({
        ...validBase,
        impactFacts: ['a', 'b', 'c', 'd', 'e', 'f'],
      });
      expect(result.success).toBe(true);
    });

    it('rejects an item exceeding 200 characters', () => {
      const longFact = 'a'.repeat(201);
      const result = createProjectSchema.safeParse({
        ...validBase,
        impactFacts: [longFact],
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((i) => i.path[0] === 'impactFacts')).toBe(true);
      }
    });

    it('accepts an item of exactly 200 characters (boundary)', () => {
      const exactFact = 'a'.repeat(200);
      const result = createProjectSchema.safeParse({
        ...validBase,
        impactFacts: [exactFact],
      });
      expect(result.success).toBe(true);
    });

    it('impactFacts validation also applies to update schema', () => {
      const result = updateProjectSchema.safeParse({
        impactFacts: ['a', 'b', 'c', 'd', 'e', 'f', 'g'],
      });
      expect(result.success).toBe(false);
    });
  });

  describe('legacy tagIds rejection', () => {
    it('rejects tagIds on create', () => {
      const result = createProjectSchema.safeParse({
        title: 'Projeto',
        status: 'draft',
        featured: false,
        order: 0,
        tagIds: [1, 2],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.message.includes('Unrecognized key'))
        ).toBe(true);
      }
    });

    it('rejects tagIds on update', () => {
      const result = updateProjectSchema.safeParse({ tagIds: [3, 3] });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((issue) => issue.message.includes('Unrecognized key'))
        ).toBe(true);
      }
    });
  });

  describe('skillIds validation', () => {
    it('accepts skillIds as optional on create', () => {
      const result = createProjectSchema.safeParse({ ...validBase });
      expect(result.success).toBe(true);
    });

    it('accepts valid unique skillIds on create', () => {
      const result = createProjectSchema.safeParse({ ...validBase, skillIds: [1, 2, 3] });
      expect(result.success).toBe(true);
    });

    it('rejects duplicate skillIds on create', () => {
      const result = createProjectSchema.safeParse({ ...validBase, skillIds: [1, 1] });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join('.') === 'skillIds')).toBe(true);
      }
    });

    it('accepts empty skillIds array on create', () => {
      const result = createProjectSchema.safeParse({ ...validBase, skillIds: [] });
      expect(result.success).toBe(true);
    });

    it('accepts valid unique skillIds on update', () => {
      const result = updateProjectSchema.safeParse({ skillIds: [10, 20] });
      expect(result.success).toBe(true);
    });

    it('rejects duplicate skillIds on update', () => {
      const result = updateProjectSchema.safeParse({ skillIds: [5, 5] });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join('.') === 'skillIds')).toBe(true);
      }
    });
  });
});
