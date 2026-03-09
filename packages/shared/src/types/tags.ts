import type { TagCategory } from '../constants/enums';

// Tag entity
export interface Tag {
  id: number;
  name: string;
  slug: string;
  category: TagCategory;
  iconKey: string | null;
  isHighlighted: boolean;
  createdAt: string;
}

// Input for creating a tag
export interface CreateTagInput {
  name: string;
  category?: TagCategory;
  isHighlighted?: boolean;
}

// Input for updating a tag
export type UpdateTagInput = Partial<CreateTagInput>;
