import type { TagCategory } from '../constants/enums';

// Tag entity
export interface Tag {
  id: number;
  name: string;
  slug: string;
  category: TagCategory;
  iconKey: string | null;
  createdAt: string;
}

// Input for creating a tag
export interface CreateTagInput {
  name: string;
  category?: TagCategory;
}

// Input for updating a tag
export type UpdateTagInput = Partial<CreateTagInput>;
