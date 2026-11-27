import { Paginated } from '@/lib/types';

export interface Post {
  _id: string;
  authorId: string;
  title: string;
  body: string;
  tags: string[];
  images: { id: string; url: string; filename: string }[];
  status: 'Draft' | 'Published';
  isHidden: boolean;
  likeCount: number;
  commentCount: number;
  interactionScore: number;
  publishedAt?: string;
  createdAt: string;
  updatedAt: string;
}

export type PaginatedPosts = Paginated<Post>;

export interface Comment {
  _id: string;
  postId: string;
  authorId: string;
  text: string;
  isHidden: boolean;
  createdAt: string;
  updatedAt: string;
}