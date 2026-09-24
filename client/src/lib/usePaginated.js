import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

// withQuery("/feed", { limit: 20, cursor: "clx9abc" })
// // → "/feed?limit=20&cursor=clx9abc"
function withQuery(path, params) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== ""),
  ).toString();
  return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
}

// `key` is the field the API returns the array under: "posts", "users",
// "comments". Everything else is the same for every endpoint.
export function usePaginated(path, key, { limit = 20, enabled = true } = {}) {
  // enabled	false	"Don't fetch at all" (used for private profiles)

  const [items, setItems] = useState([]); // the list so far
  const [nextCursor, setNextCursor] = useState(null); // bookmark for the next page
  const [loading, setLoading] = useState(enabled); // loading page 1?
  const [loadingMore, setLoadingMore] = useState(false); // loading page 2+?
  const [error, setError] = useState(null);

  // loading and loadingMore are separate because the UI shows them differently: a big "Loading…" when empty versus a small one at the bottom of the list.

  // Bumped every time the query changes. A response tagged with an old
  // value is thrown away, so a slow request can never overwrite a newer one.
  const runId = useRef(0);

  useEffect(() => {
    if (!enabled) {
      setItems([]);
      setLoading(false);
      return;
    }

    const id = ++runId.current;
    setLoading(true);
    setError(null);

    api
      .get(withQuery(path, { limit }))
      .then((data) => {
        if (id !== runId.current) return; // stale
        setItems(data[key]);
        setNextCursor(data.nextCursor);
      })
      .catch((err) => {
        if (id === runId.current) setError(err.message);
      })
      .finally(() => {
        if (id === runId.current) setLoading(false);
      });
  }, [path, key, limit, enabled]);

  const loadMore = useCallback(async () => {
    if (!nextCursor || loadingMore) return;
    const id = runId.current;
    setLoadingMore(true);
    try {
      const data = await api.get(
        withQuery(path, { limit, cursor: nextCursor }),
      );
      if (id !== runId.current) return;
      setItems((prev) => [...prev, ...data[key]]);
      setNextCursor(data.nextCursor);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoadingMore(false);
    }
  }, [path, key, limit, nextCursor, loadingMore]);

  // Local edits, so a like or a delete doesn't refetch the whole page.
  const replaceItem = useCallback((id, next) => {
    setItems((prev) => prev.map((it) => (it.id === id ? next : it))); // same list, one item swapped
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id)); // same list minus one
  }, []);

  const prependItem = useCallback((item) => {
    setItems((prev) => [item, ...prev]); // new item, then the old list
  }, []);

  const appendItem = useCallback((item) => {
    setItems((prev) => [...prev, item]); // old list, then the new item
  }, []);

  return {
    items,
    loading,
    loadingMore,
    error,
    hasMore: Boolean(nextCursor),
    loadMore,
    replaceItem,
    removeItem,
    prependItem,
    appendItem,
  };
}

// Your API doesn't send all posts at once. It sends them 20 at a time:

// js
// GET /feed?limit=20
// → { posts: [ ...20 posts... ], nextCursor: "clx9abc" }

// GET /feed?limit=20&cursor=clx9abc
// → { posts: [ ...next 20... ], nextCursor: "clx7xyz" }

// GET /feed?limit=20&cursor=clx7xyz
// → { posts: [ ...last 8... ], nextCursor: null }   ← null = no more

// The cursor is a bookmark: "continue after this post." This hook handles all of that for any list (the feed, comments, users, followers), so pages don't repeat the logic.




// replaceItem(id, next)  // swap one item    → used for likes, follow status
// removeItem(id)         // delete one item  → used for delete post/comment, accept request
// prependItem(item)      // add to the top   → new post in feed (newest first)
// appendItem(item)       // add to the bottom → new comment (oldest first)




// const feed = usePaginated("/feed", "posts");

// feed.items.map(post => <PostCard ... />)                       // draw the list
// <Composer onCreated={feed.prependItem} />                       // new post → top
// <PostCard onChange={next => feed.replaceItem(post.id, next)} /> // like
// <LoadMore hasMore={feed.hasMore} onLoadMore={feed.loadMore} />  // scroll