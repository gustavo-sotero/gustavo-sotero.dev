import { describe, expect, it } from 'vitest';
import { createProjectSchema, updateProjectSchema } from './projects';

describe('project schemas', () => {
  describe('tagIds uniqueness', () => {
    it('accepts unique tagIds on create', () => {
      const result = createProjectSchema.safeParse({
        title: 'Projeto',
        status: 'draft',
        featured: false,
        order: 0,
        tagIds: [1, 2],
      });

      expect(result.success).toBe(true);
    });

    it('rejects duplicate tagIds on create', () => {
      const result = createProjectSchema.safeParse({
        title: 'Projeto',
        status: 'draft',
        featured: false,
        order: 0,
        tagIds: [1, 1],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join('.') === 'tagIds')).toBe(true);
      }
    });

    it('rejects duplicate tagIds on update', () => {
      const result = updateProjectSchema.safeParse({ tagIds: [3, 3] });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join('.') === 'tagIds')).toBe(true);
      }
    });
  });
});
