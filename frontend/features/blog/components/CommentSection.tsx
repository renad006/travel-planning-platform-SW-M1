"use client";

import { useState } from "react";
import { api, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Comment } from "../types"; // We'll add this to types.ts

export default function CommentSection({
  postId,
  initialComments,
}: {
  postId: string;
  initialComments: Comment[];
}) {
  const { user } = useAuth();
  const [comments, setComments] = useState<Comment[]>(initialComments);
  const [newComment, setNewComment] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // For editing
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!newComment.trim() || newComment.length > 500) return;
    setLoading(true);
    setError(null);

    try {
      const created = await api.post<Comment>(`/api/posts/${postId}/comments`, {
        text: newComment,
      });
      // Add the new comment to the top or bottom (our backend returns oldest first, so we append)
      setComments([...comments, created]);
      setNewComment("");
    } catch (err) {
      if (err instanceof ApiError) setError(err.messages[0]);
      else setError("Failed to post comment");
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Are you sure you want to delete this comment?")) return;
    try {
      await api.delete(`/api/comments/${id}`);
      setComments(comments.filter((c) => c._id !== id));
    } catch (err) {
      alert("Failed to delete comment");
    }
  }

  async function handleEdit(id: string) {
    if (!editText.trim() || editText.length > 500) return;
    try {
      const updated = await api.patch<Comment>(`/api/comments/${id}`, {
        text: editText,
      });
      setComments(comments.map((c) => (c._id === id ? updated : c)));
      setEditingId(null);
    } catch (err) {
      alert("Failed to edit comment");
    }
  }

  return (
    <div className="mt-12 border-t border-slate-gray/50 pt-8">
      <h3 className="text-2xl font-bold text-primary mb-6">
        Comments ({comments.length})
      </h3>

      {/* Add Comment Form */}
      {user ? (
        <form onSubmit={handleSubmit} className="mb-8">
          <textarea
            value={newComment}
            onChange={(e) => setNewComment(e.target.value)}
            placeholder="Write a comment (max 500 characters)..."
            className="w-full border border-slate-gray rounded-md p-3 text-coffee focus:outline-none focus:ring-2 focus:ring-primary"
            rows={3}
            maxLength={500}
          />
          <div className="flex justify-between items-center mt-2">
            <span className="text-xs text-slate-gray">{newComment.length}/500</span>
            <button
              type="submit"
              disabled={loading || !newComment.trim()}
              className="bg-primary text-white px-6 py-2 rounded-md font-semibold disabled:opacity-50"
            >
              {loading ? "Posting..." : "Post Comment"}
            </button>
          </div>
          {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
        </form>
      ) : (
        <div className="bg-brand-tan/30 border border-brand-tan p-4 rounded-md mb-8 text-center">
          <p className="text-coffee">Please log in to leave a comment.</p>
        </div>
      )}

      {/* Comments List */}
      <div className="space-y-6">
        {comments.length === 0 ? (
          <p className="text-slate-gray italic">No comments yet. Be the first!</p>
        ) : (
          comments.map((comment) => (
            <div key={comment._id} className="bg-white border border-slate-gray rounded-lg p-4 shadow-sm">
              <div className="flex justify-between items-start mb-2">
                <div className="text-sm text-slate-gray">
                  <span className="font-semibold text-primary">
                    {comment.authorId === user?._id ? "You" : "User"}
                  </span>
                  <span className="mx-2">•</span>
                  <span>{new Date(comment.createdAt).toLocaleDateString()}</span>
                </div>

                {/* Edit/Delete Actions (Only for owner) */}
                {user && comment.authorId === user._id && (
                  <div className="flex gap-2 text-sm">
                    <button
                      onClick={() => {
                        setEditingId(comment._id);
                        setEditText(comment.text);
                      }}
                      className="text-slate-gray hover:text-primary"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDelete(comment._id)}
                      className="text-red-500 hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                )}
              </div>

              {/* Comment Text or Edit Form */}
              {editingId === comment._id ? (
                <div className="mt-2">
                  <textarea
                    value={editText}
                    onChange={(e) => setEditText(e.target.value)}
                    className="w-full border border-slate-gray rounded-md p-2"
                    rows={2}
                    maxLength={500}
                  />
                  <div className="flex gap-2 mt-2 justify-end">
                    <button onClick={() => setEditingId(null)} className="text-sm text-slate-gray">Cancel</button>
                    <button onClick={() => handleEdit(comment._id)} className="text-sm bg-primary text-white px-3 py-1 rounded">Save</button>
                  </div>
                </div>
              ) : (
                <p className="text-coffee whitespace-pre-wrap">{comment.text}</p>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}