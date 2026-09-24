import { useState } from "react";
import { api } from "../lib/api";

// `user` needs `username`, `isPrivate`, and `viewer.followStatus`.
// `onChange` receives the new status: null | "PENDING" | "ACCEPTED".
export default function FollowButton({ user, onChange }) {
  const [busy, setBusy] = useState(false);
  const status = user.viewer?.followStatus ?? null;

  // If you already have a status (PENDING or ACCEPTED), it sends DELETE. One endpoint covers both cases: if you were following, you unfollow; if you'd requested, the request is cancelled. The new status is null.
  async function toggle() {
    if (busy) return;
    setBusy(true);
    try {
      if (status) {
        // One endpoint covers both "unfollow" and "cancel my request".
        await api.delete(`/users/${user.username}/follow`);
        onChange(null);
      } else {
        // The server decides PENDING vs ACCEPTED from their privacy setting.
        const result = await api.put(`/users/${user.username}/follow`);
        onChange(result.status);
      }
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusy(false);
    }
  }

  const label =
    status === "ACCEPTED"
      ? "Following"
      : status === "PENDING"
        ? "Requested"
        : user.isPrivate
          ? "Request"
          : "Follow";

  const tone = status
    ? "border border-ink-700 text-ink-200 hover:border-red-500/60 hover:text-red-400"
    : "bg-indigo-500 text-white hover:bg-indigo-400";

  return (
    <button
      onClick={toggle}
      disabled={busy}
      className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition-colors disabled:opacity-50 ${tone}`}
    >
      {label}
    </button>
  );
}
