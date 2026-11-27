import { serverGet } from '@/lib/api.server';
import { PaginatedPosts, Post } from './types';

export async function getPublicPosts(params: { page?: number; tag?: string; q?: string }) {
  // The backend returns { data: [...], meta: {...} }
  const response = await serverGet<any>('/api/posts', { 
    params, 
    auth: false, 
  });

  // Map it to the shape Member 1's Paginated type expects
  return {
    items: response.data || [],
    total: response.meta?.total || 0,
    page: response.meta?.page || 1,
    limit: response.meta?.limit || 10,
  } as PaginatedPosts;
} // <--- This closing brace was missing!

export async function getPostById(id: string) {
  // For ISR pages (like a specific post), we can cache the data.
  return serverGet<Post>(`/api/posts/${id}`, { auth: false });
}

export async function getAuthorProfile(id: string, page: number = 1) {
  return serverGet<any>(`/api/authors/${id}`, {
    params: { page },
    auth: false,
  });
}

export async function getPostsByTag(tag: string, page: number = 1) {
  return serverGet<any>(`/api/tags/${tag}/posts`, {
    params: { page },
    auth: false,
  });
}

//The PDF says the Published Blog Post Detail page must be ISR (Incremental Static Regeneration).
//But the Blog List page (which you are building) is Dynamic SSR (it changes based on the ?q= search query and page number).
//  //So fetching without caching is perfectly correct here.