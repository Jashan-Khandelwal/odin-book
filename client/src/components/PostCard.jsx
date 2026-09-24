import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { timeAgo } from "../lib/time";
import Avatar from "./Avatar";

function HeartIcon({ filled }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill={filled ? "currentColor" : "none"}
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 1 0-7.8 7.8l8.8 8.6 8.8-8.6a5.5 5.5 0 0 0 0-7.8z" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.9 8.9 0 0 1-4-.9L3 21l1.9-4.9A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" />
    </svg>
  );
}

// {
//   id: "clx...",
//   content: "hello world",
//   imageUrl: null,
//   createdAt: "2026-09-23T10:00:00Z",
//   likeCount: 5,
//   commentCount: 2,
//   author: { username: "jashan", displayName: "Jashan", avatarUrl: null },
//   viewer: { hasLiked: false, isAuthor: true }   // about YOU, the viewer
// }
export default function PostCard({ post, onChange, onDelete }) {
  async function toggleLike() {
    const wasLiked = post.viewer.hasLiked;

    // Optimistic: flip the UI immediately so the button feels instant.
    onChange({
      ...post,
      likeCount: post.likeCount + (wasLiked ? -1 : 1),
      viewer: { ...post.viewer, hasLiked: !wasLiked },
    });

    try {
      const result = wasLiked
        ? await api.delete(`/posts/${post.id}/like`)
        : await api.put(`/posts/${post.id}/like`);

      // The server's count wins — someone else may have liked it meanwhile.
      onChange({
        ...post,
        likeCount: result.likeCount,
        viewer: { ...post.viewer, hasLiked: result.liked },
      });
    } catch {
      onChange(post); // roll back to exactly what we started with
    }
  }

  async function remove() {
    if (!window.confirm("Delete this post?")) return;
    try {
      await api.delete(`/posts/${post.id}`);
      onDelete(post.id);
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <article className="rounded-xl border border-ink-800 bg-ink-900/40 p-4">
      <header className="flex items-center gap-3">
        <Link to={`/u/${post.author.username}`}>
          <Avatar user={post.author} size={40} />
        </Link>
        <div className="min-w-0">
          <Link
            to={`/u/${post.author.username}`}
            className="font-medium text-white hover:underline"
          >
            {post.author.displayName}
          </Link>
          <p className="truncate text-xs text-ink-400">
            @{post.author.username} · {timeAgo(post.createdAt)}
          </p>
        </div>

        {post.viewer.isAuthor && (
          <button
            onClick={remove}
            className="ml-auto text-xs text-ink-400 transition-colors hover:text-red-400"
          >
            Delete
          </button>
        )}
      </header>

      {post.content && (
        <p className="mt-3 text-[15px] leading-relaxed whitespace-pre-wrap break-words">
          {post.content}
        </p>
      )}

      {post.imageUrl && (
        <img
          src={post.imageUrl}
          alt=""
          loading="lazy"
          className="mt-3 w-full rounded-lg border border-ink-800"
        />
      )}

      <footer className="mt-3 flex items-center gap-5 text-sm">
        <button
          onClick={toggleLike}
          aria-pressed={post.viewer.hasLiked}
          className={`flex items-center gap-1.5 transition-colors ${
            post.viewer.hasLiked
              ? "text-rose-400"
              : "text-ink-400 hover:text-rose-400"
          }`}
        >
          <HeartIcon filled={post.viewer.hasLiked} />
          {post.likeCount}
        </button>

        <Link
          to={`/p/${post.id}`}
          className="flex items-center gap-1.5 text-ink-400 transition-colors hover:text-indigo-400"
        >
          <CommentIcon />
          {post.commentCount}
        </Link>
      </footer>
    </article>
  );
}
