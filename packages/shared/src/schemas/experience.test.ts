import { describe, expect, it } from 'vitest';
import { createExperienceSchema, updateExperienceSchema } from './experience';

const valid = {
  role: 'Software Engineer',
  company: 'Acme Corp',
  description: 'Built things.',
  startDate: '2022-01-01',
  endDate: '2023-06-30',
  isCurrent: false,
};

describe('createExperienceSchema', () => {
  describe('endDate required when isCurrent is false', () => {
    it('accepts a non-current entry with endDate', () => {
      const result = createExperienceSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });

    it('rejects a non-current entry without endDate', () => {
      const { endDate: _omitted, ...noEnd } = valid;
      const result = createExperienceSchema.safeParse({ ...noEnd, isCurrent: false });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('endDate');
      }
    });

    it('accepts a current entry without endDate', () => {
      const { endDate: _omitted, ...noEnd } = valid;
      const result = createExperienceSchema.safeParse({ ...noEnd, isCurrent: true });
      expect(result.success).toBe(true);
    });

    it('accepts a current entry with endDate (date is ignored but valid)', () => {
      const result = createExperienceSchema.safeParse({ ...valid, isCurrent: true });
      expect(result.success).toBe(true);
    });
  });

  describe('date chronology validation', () => {
    it('rejects endDate earlier than startDate', () => {
      const result = createExperienceSchema.safeParse({
        ...valid,
        startDate: '2023-01-01',
        endDate: '2022-06-30',
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        const paths = result.error.issues.map((i) => i.path.join('.'));
        expect(paths).toContain('endDate');
        const messages = result.error.issues.map((i) => i.message);
        expect(messages.some((m) => m.includes('startDate'))).toBe(true);
      }
    });

    it('accepts endDate equal to startDate', () => {
      const result = createExperienceSchema.safeParse({
        ...valid,
        startDate: '2023-01-01',
        endDate: '2023-01-01',
      });
      expect(result.success).toBe(true);
    });

    it('accepts endDate after startDate', () => {
      const result = createExperienceSchema.safeParse(valid);
      expect(result.success).toBe(true);
    });
  });

  describe('required fields', () => {
    it('rejects missing role', () => {
      const { role: _r, ...noRole } = valid;
      const result = createExperienceSchema.safeParse(noRole);
      expect(result.success).toBe(false);
    });

    it('rejects missing company', () => {
      const { company: _c, ...noCompany } = valid;
      const result = createExperienceSchema.safeParse(noCompany);
      expect(result.success).toBe(false);
    });

    it('rejects missing startDate', () => {
      const { startDate: _s, ...noStart } = valid;
      const result = createExperienceSchema.safeParse(noStart);
      expect(result.success).toBe(false);
    });
  });

  describe('date format validation', () => {
    it('rejects invalid date format for startDate', () => {
      const result = createExperienceSchema.safeParse({ ...valid, startDate: '01/01/2022' });
      expect(result.success).toBe(false);
    });

    it('rejects invalid date format for endDate', () => {
      const result = createExperienceSchema.safeParse({ ...valid, endDate: 'invalid-date' });
      expect(result.success).toBe(false);
    });
  });

  describe('tagIds uniqueness', () => {
    it('accepts unique tagIds', () => {
      const result = createExperienceSchema.safeParse({ ...valid, tagIds: [1, 2] });
      expect(result.success).toBe(true);
    });

    it('rejects duplicate tagIds on create', () => {
      const result = createExperienceSchema.safeParse({ ...valid, tagIds: [1, 1] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join('.') === 'tagIds')).toBe(true);
      }
    });

    it('rejects duplicate tagIds on update', () => {
      const result = updateExperienceSchema.safeParse({ tagIds: [3, 3] });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(result.error.issues.some((issue) => issue.path.join('.') === 'tagIds')).toBe(true);
      }
    });
  });
});
