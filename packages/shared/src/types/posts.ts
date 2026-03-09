import type { PostStatus } from '../constants/enums';
import type { Tag } from './tags';

// Full post entity (admin view)
export interface Post {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  renderedContent: string | null;
  coverUrl: string | null;
  status: PostStatus;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
  scheduledAt: string | null;
  tags?: Tag[];
}

// Minimal post for public listing
export interface PostListItem {
  id: number;
  slug: string;
  title: string;
  excerpt: string | null;
  coverUrl: string | null;
  status: PostStatus;
  publishedAt: string | null;
  scheduledAt: string | null;
  tags?: Tag[];
}

// Input for creating a post
export interface CreatePostDto {
  title: string;
  slug?: string;
  content: string;
  excerpt?: string;
  coverUrl?: string;
  status?: PostStatus;
  tagIds?: number[];
  scheduledAt?: string;
}

// Input for updating a post (all fields optional)
export type UpdatePostDto = Partial<CreatePostDto>;
