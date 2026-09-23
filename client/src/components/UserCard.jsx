import { Link } from "react-router-dom";
import Avatar from "./Avatar";

// The action on the right differs per page — Follow on the directory,
// Accept/Reject on the requests page — so it comes in as children.
export default function UserCard({ user, children }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-ink-800 bg-ink-900/40 p-3">
      <Link to={`/u/${user.username}`}>
        <Avatar user={user} size={44} />
      </Link>

      <div className="min-w-0 flex-1">
        <Link
          to={`/u/${user.username}`}
          className="font-medium text-white hover:underline"
        >
          {user.displayName}
        </Link>
        <p className="truncate text-xs text-ink-400">@{user.username}</p>
        {user.bio && (
          <p className="mt-0.5 truncate text-sm text-ink-400">{user.bio}</p>
        )}
      </div>

      {children}
    </li>
  );
}
