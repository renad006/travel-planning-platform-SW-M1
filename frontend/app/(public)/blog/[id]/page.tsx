import { getPostById } from '@/features/blog/api';
import Link from 'next/link';
import { notFound } from 'next/navigation';

// ISR: Revalidate every 60 seconds
export const revalidate = 60;

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const resolvedParams = await params;
  const post = await getPostById(resolvedParams.id);

  // If the post doesn't exist, show the 404 page
  if (!post) {
    notFound();
  }

  return (
    <div className="container mx-auto p-4 max-w-3xl mt-8">
      <Link href="/blog" className="text-slate-gray hover:text-primary mb-6 inline-block">
        ← Back to Blog
      </Link>

      <article className="border border-slate-gray rounded-xl p-8 bg-white shadow-sm">
        <h1 className="text-4xl font-bold text-primary mb-4">{post.title}</h1>
        
        <div className="flex flex-wrap gap-2 mb-6">
          {post.tags.map((t) => (
            <Link 
              key={t} 
              href={`/blog?tag=${t}`}
              className="bg-brand-tan text-primary text-sm px-3 py-1 rounded-full font-semibold hover:opacity-80"
            >
              #{t}
            </Link>
          ))}
        </div>

        <div className="text-slate-gray text-sm mb-8 flex gap-4 border-b border-slate-gray/30 pb-4">
          <span>Published: {new Date(post.publishedAt || post.createdAt).toLocaleDateString()}</span>
          <span>❤️ {post.likeCount} Likes</span>
          <span>💬 {post.commentCount} Comments</span>
        </div>

        {/* Images Grid */}
        {post.images && post.images.length > 0 && (
          <div className="grid grid-cols-2 gap-4 mb-8">
            {post.images.map((img) => (
               <img key={img.id} src={img.url} alt="Post image" className="rounded-lg object-cover w-full h-48" />
            ))}
          </div>
        )}

        {/* Post Body */}
        <div className="text-coffee leading-relaxed whitespace-pre-wrap text-lg">
          {post.body}
        </div>
      </article>

      {/* Placeholder for Comments (We will build this next) */}
      <div className="mt-12 border-t border-slate-gray/50 pt-8">
        <h3 className="text-2xl font-bold text-primary mb-4">Comments</h3>
        <p className="text-slate-gray italic">Client-side comments component will go here.</p>
      </div>
    </div>
  );
}