import Link from 'next/link';
import { getPostsByTag } from '@/features/blog/api';

export default async function TagPage({
  params,
  searchParams,
}: {
  params: Promise<{ tag: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;
  
  const data = await getPostsByTag(resolvedParams.tag, page);
  const posts = data.data || [];

  return (
    <div className="container mx-auto p-4 max-w-5xl mt-8">
      <Link href="/blog" className="text-slate-gray hover:text-primary mb-6 inline-block">
        ← Back to Blog
      </Link>

      <div className="bg-brand-tan/20 border border-brand-tan rounded-lg p-8 mb-8 text-center">
        <h1 className="text-3xl font-bold text-primary mb-2">
          Posts tagged with <span className="text-caput-mortuum">#{resolvedParams.tag}</span>
        </h1>
        <p className="text-coffee">Found {data.meta?.total || posts.length} posts</p>
      </div>

      {posts.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-gray rounded-lg">
          <p className="text-slate-gray text-lg">No posts found with this tag.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post: any) => (
            <div key={post._id} className="border border-slate-gray rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <h2 className="text-2xl font-bold text-primary mb-2 line-clamp-2">{post.title}</h2>
              <p className="text-coffee mb-4 line-clamp-3 flex-grow">{post.body}</p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((t: string) => (
                  <span key={t} className="bg-brand-tan text-primary text-xs px-2 py-1 rounded-full font-semibold">
                    {t}
                  </span>
                ))}
              </div>

              <div className="flex items-center justify-between mt-auto pt-4 border-t border-slate-gray/30">
                <div className="text-sm text-slate-gray flex gap-4">
                  <span>❤️ {post.likeCount}</span>
                  <span>💬 {post.commentCount}</span>
                </div>
                <Link href={`/blog/${post._id}`} className="text-primary font-semibold hover:underline">
                  Read more →
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}