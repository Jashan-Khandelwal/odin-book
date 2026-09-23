import { useState } from "react";
import { usePaginated } from "../lib/usePaginated";
import { useDebounced } from "../lib/useDebounced";
import UserCard from "../components/UserCard";
import FollowButton from "../components/FollowButton";
import LoadMore from "../components/LoadMore";

export default function Users() {
  const [query, setQuery] = useState("");
  const q = useDebounced(query, 300);

  // Changing the path restarts pagination from page one, which is exactly
  // what a new search should do.
  const path = q ? `/users?q=${encodeURIComponent(q)}` : "/users";
  const list = usePaginated(path, "users");

  function setStatus(user, status) {
    list.replaceItem(user.id, {
      ...user,
      viewer: { ...user.viewer, followStatus: status },
    });
  }

  return (
    <div>
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search people…"
        className="mb-4 w-full rounded-lg border border-ink-800 bg-ink-900 px-3 py-2 outline-none focus:border-indigo-500 placeholder:text-ink-700"
      />

      {list.error && <p className="text-sm text-red-400">{list.error}</p>}
      {list.loading && (
        <p className="py-8 text-center text-ink-400">Loading…</p>
      )}

      {!list.loading && list.items.length === 0 && (
        <p className="py-10 text-center text-ink-400">
          {q ? `No one matching "${q}".` : "No other users yet."}
        </p>
      )}

      <ul className="space-y-2">
        {list.items.map((user) => (
          <UserCard key={user.id} user={user}>
            <FollowButton
              user={user}
              onChange={(status) => setStatus(user, status)}
            />
          </UserCard>
        ))}
      </ul>

      <LoadMore
        hasMore={list.hasMore}
        loading={list.loadingMore}
        onLoadMore={list.loadMore}
      />
    </div>
  );
}
