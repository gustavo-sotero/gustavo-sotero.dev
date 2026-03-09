import type { PostStatus } from '../constants/enums';

// Full education entity (admin view)
export interface Education {
  id: number;
  slug: string;
  title: string;
  institution: string;
  description: string | null;
  location: string | null;
  educationType: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  workloadHours: number | null;
  credentialId: string | null;
  credentialUrl: string | null;
  order: number;
  status: PostStatus;
  logoUrl: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// Minimal education for public listing
export interface EducationListItem {
  id: number;
  slug: string;
  title: string;
  institution: string;
  description: string | null;
  location: string | null;
  educationType: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  workloadHours: number | null;
  credentialId: string | null;
  credentialUrl: string | null;
  order: number;
  logoUrl: string | null;
}

// Input for creating an education entry
export interface CreateEducationDto {
  title: string;
  institution: string;
  description?: string;
  slug?: string;
  location?: string;
  educationType?: string;
  startDate?: string;
  endDate?: string;
  isCurrent?: boolean;
  workloadHours?: number;
  credentialId?: string;
  credentialUrl?: string;
  order?: number;
  status?: PostStatus;
  logoUrl?: string;
}

// Input for updating an education entry (all fields optional)
export type UpdateEducationDto = Partial<CreateEducationDto>;
