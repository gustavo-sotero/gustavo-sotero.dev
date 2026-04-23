import type { SkillCategory } from '../constants/enums';

/** Public read DTO for a single skill. */
export interface Skill {
  id: number;
  name: string;
  slug: string;
  category: SkillCategory;
  iconKey: string | null;
  expertiseLevel: 1 | 2 | 3;
  isHighlighted: boolean;
  createdAt: string;
}

/** Admin write input for creating a skill. */
export interface CreateSkillInput {
  name: string;
  category: SkillCategory;
  expertiseLevel: 1 | 2 | 3;
  isHighlighted?: boolean;
}

/** Admin write input for updating a skill (all fields optional). */
export type UpdateSkillInput = Partial<CreateSkillInput>;
