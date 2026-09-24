import { useEffect } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { usePaginated } from "../lib/usePaginated";
import { useNotifications } from "../context/NotificationContext";
import { timeAgo } from "../lib/time";
import Avatar from "../components/Avatar";
import LoadMore from "../components/LoadMore";

const TEXT = {
  LIKE: "liked your post",
  COMMENT: "commented on your post",
  FOLLOW_REQUEST: "requested to follow you",
  FOLLOW_ACCEPTED: "accepted your follow request",
  NEW_FOLLOWER: "started following you",
};

export default function Notifications() {
  const list = usePaginated("/notifications", "notifications");
  const { setUnreadCount } = useNotifications();

  // Opening the page is what marks them read. Runs once on mount.
  useEffect(() => {
    api
      .post("/notifications/read")
      .then(() => setUnreadCount(0))
      .catch(() => {});
  }, [setUnreadCount]);

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-white">Notifications</h1>

      {list.error && <p className="text-sm text-red-400">{list.error}</p>}
      {list.loading && (
        <p className="py-8 text-center text-ink-400">Loading…</p>
      )}

      {!list.loading && list.items.length === 0 && (
        <p className="py-10 text-center text-ink-400">Nothing yet.</p>
      )}

      <ul className="space-y-2">
        {list.items.map((n) => {
          // Follow notifications point at a profile, post ones at the post.
          const to = n.post ? `/p/${n.post.id}` : `/u/${n.actor.username}`;

          return (
            <li key={n.id}>
              <Link
                to={to}
                className={`flex items-center gap-3 rounded-xl border p-3 transition-colors hover:bg-ink-900 ${
                  n.read
                    ? "border-ink-800 bg-ink-900/30"
                    : "border-indigo-500/30 bg-indigo-500/5"
                }`}
              >
                <Avatar user={n.actor} size={40} />
                <div className="min-w-0 flex-1">
                  <p className="text-sm">
                    <span className="font-medium text-white">
                      {n.actor.displayName}
                    </span>{" "}
                    <span className="text-ink-400">{TEXT[n.type]}</span>
                  </p>
                  {n.post?.content && (
                    <p className="truncate text-xs text-ink-700">
                      {n.post.content}
                    </p>
                  )}
                  <p className="text-xs text-ink-400">{timeAgo(n.createdAt)}</p>
                </div>
                {!n.read && (
                  <span className="size-2 shrink-0 rounded-full bg-indigo-400" />
                )}
              </Link>
            </li>
          );
        })}
      </ul>

      <LoadMore
        hasMore={list.hasMore}
        loading={list.loadingMore}
        onLoadMore={list.loadMore}
      />
    </div>
  );
}
