import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "./api";

function withQuery(path, params) {
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== ""),
  ).toString();
  return qs ? `${path}${path.includes("?") ? "&" : "?"}${qs}` : path;
}

// `key` is the field the API returns the array under: "posts", "users",
// "comments". Everything else is the same for every endpoint.
export function usePaginated(path, key, { limit = 20, enabled = true } = {}) {
  const [items, setItems] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [loading, setLoading] = useState(enabled);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);

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
    setItems((prev) => prev.map((it) => (it.id === id ? next : it)));
  }, []);

  const removeItem = useCallback((id) => {
    setItems((prev) => prev.filter((it) => it.id !== id));
  }, []);

  const prependItem = useCallback((item) => {
    setItems((prev) => [item, ...prev]);
  }, []);

  const appendItem = useCallback((item) => {
    setItems((prev) => [...prev, item]);
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
