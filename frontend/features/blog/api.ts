import { serverGet } from '@/lib/api.server';
import { PaginatedPosts } from './types';

export async function getPublicPosts(params: { page?: number; tag?: string; q?: string }) {
  // The backend actually returns { data: [...], meta: {...} }
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
}

//The PDF says the Published Blog Post Detail page must be ISR (Incremental Static Regeneration).
//But the Blog List page (which you are building) is Dynamic SSR (it changes based on the ?q= search query and page number).
//  //So fetching without caching is perfectly correct here.