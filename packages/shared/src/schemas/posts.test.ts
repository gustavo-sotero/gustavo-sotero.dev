import { describe, expect, it } from 'vitest';
import { createPostSchema, updatePostSchema } from './posts';

describe('post schemas', () => {
  describe('tagIds uniqueness', () => {
    it('accepts unique tagIds on create', () => {
      const result = createPostSchema.safeParse({
        title: 'Post',
        content: 'Conteudo',
        status: 'draft',
        tagIds: [1, 2],
      });

      expect(result.success).toBe(true);
    });

    it('rejects duplicate tagIds on create', () => {
      const result = createPostSchema.safeParse({
        title: 'Post',
        content: 'Conteudo',
        status: 'draft',
        tagIds: [1, 1],
      });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join('.') === 'tagIds')).toBe(true);
      }
    });

    it('rejects duplicate tagIds on update', () => {
      const result = updatePostSchema.safeParse({ tagIds: [2, 2] });

      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join('.') === 'tagIds')).toBe(true);
      }
    });
  });
});
