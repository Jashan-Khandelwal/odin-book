import { useState } from "react";
import { api } from "../lib/api";
import { usePaginated } from "../lib/usePaginated";
import UserCard from "../components/UserCard";
import LoadMore from "../components/LoadMore";

export default function Requests() {
  const list = usePaginated("/follow-requests", "users");
  const [busyId, setBusyId] = useState(null);

  async function respond(user, action) {
    setBusyId(user.id);
    try {
      await api.post(`/follow-requests/${user.username}/${action}`);
      // Either way the request is resolved, so it leaves the list.
      list.removeItem(user.id);
    } catch (err) {
      window.alert(err.message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-lg font-semibold text-white">Follow requests</h1>

      {list.error && <p className="text-sm text-red-400">{list.error}</p>}
      {list.loading && <p className="py-8 text-center text-ink-400">Loading…</p>}

      {!list.loading && list.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-800 p-10 text-center">
          <p className="font-medium text-ink-200">No pending requests.</p>
          <p className="mt-1 text-sm text-ink-400">
            Requests only appear here while your account is private.
          </p>
        </div>
      )}

      <ul className="space-y-2">
        {list.items.map((user) => (
          <UserCard key={user.id} user={user}>
            <div className="flex shrink-0 gap-2">
              <button
                onClick={() => respond(user, "accept")}
                disabled={busyId === user.id}
                className="rounded-full bg-indigo-500 px-4 py-1.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
              >
                Accept
              </button>
              <button
                onClick={() => respond(user, "reject")}
                disabled={busyId === user.id}
                className="rounded-full border border-ink-700 px-4 py-1.5 text-sm hover:border-red-500/60 hover:text-red-400 disabled:opacity-50"
              >
                Reject
              </button>
            </div>
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
