import { describe, expect, it } from 'vitest';
import { createPostSchema, postQuerySchema, updatePostSchema } from './posts';

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

  describe('order field', () => {
    it('defaults order to 0 on create when not provided', () => {
      const result = createPostSchema.safeParse({
        title: 'Post',
        content: 'Conteudo',
        status: 'draft',
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.order).toBe(0);
      }
    });

    it('accepts explicit order on create', () => {
      const result = createPostSchema.safeParse({
        title: 'Post',
        content: 'Conteudo',
        status: 'draft',
        order: 5,
      });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.order).toBe(5);
      }
    });

    it('accepts partial order update', () => {
      const result = updatePostSchema.safeParse({ order: 3 });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.order).toBe(3);
      }
    });
  });

  describe('postQuerySchema sort', () => {
    it('defaults sort to recent when omitted', () => {
      const result = postQuerySchema.safeParse({});

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sort).toBe('recent');
      }
    });

    it('accepts sort=manual', () => {
      const result = postQuerySchema.safeParse({ sort: 'manual' });

      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.sort).toBe('manual');
      }
    });

    it('rejects invalid sort values', () => {
      const result = postQuerySchema.safeParse({ sort: 'popular' });

      expect(result.success).toBe(false);
    });
  });
});
