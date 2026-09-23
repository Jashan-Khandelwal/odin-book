import { useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { usePaginated } from "../lib/usePaginated";
import { timeAgo } from "../lib/time";
import Avatar from "./Avatar";
import LoadMore from "./LoadMore";

export default function Comments({ postId, onCountChange }) {
  const list = usePaginated(`/posts/${postId}/comments`, "comments");
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  async function submit(e) {
    e.preventDefault();
    if (!content.trim() || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { comment } = await api.post(`/posts/${postId}/comments`, {
        content,
      });
      // Comments read oldest-first, so a new one belongs at the END.
      list.appendItem(comment);
      onCountChange(1);
      setContent("");
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(id) {
    try {
      await api.delete(`/comments/${id}`);
      list.removeItem(id);
      onCountChange(-1);
    } catch (err) {
      window.alert(err.message);
    }
  }

  return (
    <section className="rounded-xl border border-ink-800 bg-ink-900/40 p-4">
      <h2 className="mb-4 text-sm font-semibold text-ink-400">Comments</h2>

      <form onSubmit={submit} className="mb-5 flex gap-2">
        <input
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write a comment…"
          maxLength={300}
          className="flex-1 rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 text-sm outline-none focus:border-indigo-500 placeholder:text-ink-700"
        />
        <button
          type="submit"
          disabled={!content.trim() || busy}
          className="rounded-lg bg-indigo-500 px-4 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-40"
        >
          Send
        </button>
      </form>

      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}

      {list.loading && <p className="text-sm text-ink-400">Loading…</p>}

      {!list.loading && list.items.length === 0 && (
        <p className="text-sm text-ink-700">No comments yet.</p>
      )}

      <ul className="space-y-4">
        {list.items.map((c) => (
          <li key={c.id} className="flex gap-3">
            <Link to={`/u/${c.author.username}`}>
              <Avatar user={c.author} size={32} />
            </Link>
            <div className="min-w-0 flex-1">
              <p className="text-sm">
                <Link
                  to={`/u/${c.author.username}`}
                  className="font-medium text-white hover:underline"
                >
                  {c.author.displayName}
                </Link>{" "}
                <span className="text-xs text-ink-400">
                  {timeAgo(c.createdAt)}
                </span>
              </p>
              <p className="text-sm whitespace-pre-wrap break-words text-ink-200">
                {c.content}
              </p>
            </div>
            {c.viewer.canDelete && (
              <button
                onClick={() => remove(c.id)}
                className="text-xs text-ink-700 hover:text-red-400"
              >
                Delete
              </button>
            )}
          </li>
        ))}
      </ul>

      <LoadMore
        hasMore={list.hasMore}
        loading={list.loadingMore}
        onLoadMore={list.loadMore}
      />
    </section>
  );
}
