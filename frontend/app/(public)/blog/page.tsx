import Link from 'next/link';
import { getPublicPosts } from '@/features/blog/api';

export default async function BlogPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; tag?: string; q?: string }>;
}) {
  const resolvedParams = await searchParams;
  const page = Number(resolvedParams.page) || 1;
  const tag = resolvedParams.tag;
  const q = resolvedParams.q;

  let data = null;
  let errorMsg = null;

  try {
    data = await getPublicPosts({ page, tag, q });
  } catch (error: any) {
    console.error("FETCH ERROR:", error);
    errorMsg = error.message || "Unknown error occurred";
  }

  if (errorMsg) {
    return (
      <div className="container mx-auto p-10 text-center text-red-500 font-mono bg-red-50 border border-red-200 rounded mt-10">
        <h2 className="text-xl font-bold mb-4">Failed to load posts</h2>
        <p>{errorMsg}</p>
      </div>
    );
  }

  if (!data || !data.items) {
    return <div className="p-10 text-center">Data is in an unexpected format.</div>;
  }

  return (
    <div className="container mx-auto p-4 max-w-5xl">
      <h1 className="text-4xl font-bold text-primary mb-8">Travel Blog</h1>

      <form className="mb-8 flex gap-2">
        <input
          type="text"
          name="q"
          defaultValue={q}
          placeholder="Search posts..."
          className="border border-slate-gray rounded-md p-2 w-full max-w-md"
        />
        <button type="submit" className="bg-brand-tan text-primary font-semibold px-4 py-2 rounded-md hover:opacity-90">
          Search
        </button>
      </form>

      {data.items.length === 0 ? (
        <div className="text-center py-20 border border-dashed border-slate-gray rounded-lg">
          <p className="text-slate-gray text-lg">No posts found. Try a different search!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {data.items.map((post) => (
            <div key={post._id} className="border border-slate-gray rounded-lg p-6 shadow-sm hover:shadow-md flex flex-col">
              
              <Link 
                href={`/authors/${post.authorId}`} 
                className="text-sm text-slate-gray hover:text-primary hover:underline mb-3 block"
              >
                By Author
              </Link>

              <h2 className="text-2xl font-bold text-primary mb-2 line-clamp-2">{post.title}</h2>
              <p className="text-coffee mb-4 line-clamp-3 flex-grow">{post.body}</p>
              
              <div className="flex flex-wrap gap-2 mb-4">
                {post.tags.map((t) => (
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