"use client";

import { useState } from "react";
import { api } from "@/lib/api";
import { ApiError } from "@/lib/api";

export default function LikeButton({
  postId,
  initialLikes,
  initialLikedByMe,
}: {
  postId: string;
  initialLikes: number;
  initialLikedByMe: boolean;
}) {
  const [likes, setLikes] = useState(initialLikes);
  const [isLiked, setIsLiked] = useState(initialLikedByMe);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggleLike() {
    if (loading) return; // Prevent double clicks
    setLoading(true);
    setError(null);

    try {
      if (isLiked) {
        await api.delete(`/api/posts/${postId}/like`);
        setLikes((prev) => prev - 1);
        setIsLiked(false);
      } else {
        await api.post(`/api/posts/${postId}/like`);
        setLikes((prev) => prev + 1);
        setIsLiked(true);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.messages[0]); // Show backend error (like 401 not logged in)
      } else {
        setError("Failed to update like");
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={toggleLike}
        disabled={loading}
        className={`flex items-center gap-2 px-4 py-2 rounded-full font-semibold transition-colors ${
          isLiked
            ? "bg-caput-mortuum text-white"
            : "bg-white border border-slate-gray text-coffee hover:bg-gray-50"
        }`}
      >
        <span className="text-xl">{isLiked ? "❤️" : "🤍"}</span>
        <span>{likes}</span>
      </button>
      {error && <p className="text-red-500 text-xs mt-1">{error}</p>}
    </div>
  );
}