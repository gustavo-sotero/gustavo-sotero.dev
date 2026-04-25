import type { PostStatus } from '../constants/enums';
import type { Skill } from './skills';

// Full experience entity (admin view)
export interface Experience {
  id: number;
  slug: string;
  role: string;
  company: string;
  description: string;
  location: string | null;
  employmentType: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  order: number;
  impactFacts: string[];
  status: PostStatus;
  logoUrl: string | null;
  credentialUrl: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  skills?: Skill[];
}

// Minimal experience for public listing
export interface ExperienceListItem {
  id: number;
  slug: string;
  role: string;
  company: string;
  description: string;
  location: string | null;
  employmentType: string | null;
  startDate: string;
  endDate: string | null;
  isCurrent: boolean;
  order: number;
  impactFacts: string[];
  logoUrl: string | null;
  credentialUrl: string | null;
  skills?: Skill[];
}

// Input for creating an experience entry
export interface CreateExperienceDto {
  role: string;
  company: string;
  description: string;
  slug?: string;
  location?: string;
  employmentType?: string;
  startDate: string;
  endDate?: string;
  isCurrent?: boolean;
  order?: number;
  status?: PostStatus;
  logoUrl?: string;
  credentialUrl?: string;
  impactFacts?: string[];
  skillIds?: number[];
}

// Input for updating an experience entry (all fields optional)
export type UpdateExperienceDto = Partial<CreateExperienceDto>;
