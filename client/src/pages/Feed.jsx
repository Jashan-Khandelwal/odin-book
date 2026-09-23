import Composer from "../components/Composer";
import PostCard from "../components/PostCard";
import LoadMore from "../components/LoadMore";
import { usePaginated } from "../lib/usePaginated";

export default function Feed() {
  const feed = usePaginated("/feed", "posts");

  return (
    <div className="space-y-4">
      <Composer onCreated={feed.prependItem} />

      {feed.error && (
        <p className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-400">
          {feed.error}
        </p>
      )}

      {feed.loading && (
        <p className="py-8 text-center text-ink-400">Loading…</p>
      )}

      {!feed.loading && feed.items.length === 0 && (
        <div className="rounded-xl border border-dashed border-ink-800 p-10 text-center">
          <p className="font-medium text-ink-200">Your feed is empty.</p>
          <p className="mt-1 text-sm text-ink-400">
            Follow some people, or write your first post.
          </p>
        </div>
      )}

      {feed.items.map((post) => (
        <PostCard
          key={post.id}
          post={post}
          onChange={(next) => feed.replaceItem(post.id, next)}
          onDelete={feed.removeItem}
        />
      ))}

      <LoadMore
        hasMore={feed.hasMore}
        loading={feed.loadingMore}
        onLoadMore={feed.loadMore}
      />
    </div>
  );
}
