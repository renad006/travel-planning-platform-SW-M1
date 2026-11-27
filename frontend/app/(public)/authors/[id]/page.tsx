import Link from 'next/link';
import { getAuthorProfile } from '@/features/blog/api';

export default async function AuthorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ page?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const page = Number(resolvedSearchParams.page) || 1;

  const data = await getAuthorProfile(resolvedParams.id, page);

  // If the backend returns 404, show a friendly message
  if (!data || !data.author) {
    return (
      <div className="container mx-auto p-10 text-center">
        <h1 className="text-2xl font-bold text-primary mb-4">Author not found</h1>
        <Link href="/blog" className="text-slate-gray hover:underline">Back to Blog</Link>
      </div>
    );
  }

  const author = data.author;
  const posts = data.posts?.data || [];
  const totalPosts = data.posts?.meta?.total || 0;

  return (
    <div className="container mx-auto p-4 max-w-5xl mt-8">
      <Link href="/blog" className="text-slate-gray hover:text-primary mb-6 inline-block">
        ← Back to Blog
      </Link>

      {/* Author Header */}
      <div className="bg-primary text-white rounded-xl p-8 mb-8 shadow-md">
        <div className="flex items-center gap-6">
          {/* Avatar Placeholder */}
          <div className="w-24 h-24 bg-brand-tan text-primary rounded-full flex items-center justify-center text-4xl font-bold">
            {author.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h1 className="text-3xl font-bold mb-2">{author.name}</h1>
            <p className="text-brand-tan">
              Joined {new Date(author.joinDate).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </p>
            <p className="text-slate-gray mt-1">Published {totalPosts} posts</p>
          </div>
        </div>
      </div>

      {/* Posts List */}
      <h2 className="text-2xl font-bold text-primary mb-4">Published Posts</h2>
      
      {posts.length === 0 ? (
        <div className="text-center py-12 border border-dashed border-slate-gray rounded-lg">
          <p className="text-slate-gray text-lg">This author hasn't published any posts yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {posts.map((post: any) => (
            <div key={post._id} className="border border-slate-gray rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow flex flex-col">
              <h3 className="text-xl font-bold text-primary mb-2 line-clamp-2">{post.title}</h3>
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