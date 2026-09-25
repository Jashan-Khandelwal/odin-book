import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useNotifications } from "../context/NotificationContext";
import Avatar from "./Avatar";

const TEXT = {
  LIKE: "liked your post",
  COMMENT: "commented on your post",
  FOLLOW_REQUEST: "requested to follow you",
  FOLLOW_ACCEPTED: "accepted your follow request",
  NEW_FOLLOWER: "started following you",
};

export default function Toast() {
  const { latest, setLatest } = useNotifications();

  useEffect(() => {
    if (!latest) return;
    const timer = setTimeout(() => setLatest(null), 5000);
    // Restarting the timer on each new notification is what stops a burst
    // of them from dismissing the last one early.
    return () => clearTimeout(timer);
  }, [latest, setLatest]);

  if (!latest) return null;

  const to = latest.post
    ? `/p/${latest.post.id}`
    : `/u/${latest.actor.username}`;

  return (
    <Link
      to={to}
      onClick={() => setLatest(null)}
      className="fixed bottom-5 left-1/2 z-50 flex w-[min(92vw,26rem)] -translate-x-1/2 items-center gap-3 rounded-xl border border-ink-700 bg-ink-900 p-3 shadow-xl shadow-black/40"
    >
      <Avatar user={latest.actor} size={36} />
      <p className="min-w-0 flex-1 text-sm">
        <span className="font-medium text-white">
          {latest.actor.displayName}
        </span>{" "}
        <span className="text-ink-400">{TEXT[latest.type]}</span>
      </p>
      <button
        onClick={(e) => {
          e.preventDefault();
          setLatest(null);
        }}
        className="shrink-0 px-1 text-ink-400 hover:text-ink-200"
        aria-label="Dismiss"
      >
        ×
      </button>
    </Link>
  );
}
