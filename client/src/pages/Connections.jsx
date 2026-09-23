import { Link, useParams } from "react-router-dom";
import { usePaginated } from "../lib/usePaginated";
import UserCard from "../components/UserCard";
import FollowButton from "../components/FollowButton";
import LoadMore from "../components/LoadMore";

// One component for both /followers and /following — the API endpoints are
// mirror images, so the page is too.
export default function Connections({ direction }) {
  const { username } = useParams();
  const list = usePaginated(`/users/${username}/${direction}`, "users");

  return (
    <div>
      <Link
        to={`/u/${username}`}
        className="mb-4 inline-block text-sm text-ink-400 hover:text-ink-200"
      >
        ← @{username}
      </Link>

      <h1 className="mb-4 text-lg font-semibold capitalize text-white">
        {direction}
      </h1>

      {list.error && <p className="text-sm text-red-400">{list.error}</p>}
      {list.loading && (
        <p className="py-8 text-center text-ink-400">Loading…</p>
      )}
      {!list.loading && list.items.length === 0 && (
        <p className="py-10 text-center text-ink-400">Nobody here yet.</p>
      )}

      <ul className="space-y-2">
        {list.items.map((user) => (
          <UserCard key={user.id} user={user}>
            {!user.viewer?.isSelf && (
              <FollowButton
                user={user}
                onChange={(status) =>
                  list.replaceItem(user.id, {
                    ...user,
                    viewer: { ...user.viewer, followStatus: status },
                  })
                }
              />
            )}
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
