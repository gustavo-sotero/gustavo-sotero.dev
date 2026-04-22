import type { PostStatus } from '../constants/enums';
import type { Tag } from './tags';

// Full project entity (admin view)
export interface Project {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  content: string | null;
  renderedContent: string | null;
  coverUrl: string | null;
  status: PostStatus;
  repositoryUrl: string | null;
  liveUrl: string | null;
  featured: boolean;
  order: number;
  impactFacts: string[];
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags?: Tag[];
}

// Minimal project for public listing
export interface ProjectListItem {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  status: PostStatus;
  featured: boolean;
  order: number;
  impactFacts: string[];
  tags?: Tag[];
}

// Input for creating a project
export interface CreateProjectDto {
  title: string;
  slug?: string;
  description?: string;
  content?: string;
  coverUrl?: string;
  status?: PostStatus;
  repositoryUrl?: string;
  liveUrl?: string;
  featured?: boolean;
  order?: number;
  impactFacts?: string[];
  tagIds?: number[];
}

// Input for updating a project (all fields optional)
export type UpdateProjectDto = Partial<CreateProjectDto>;
