import { useEffect, useRef } from "react";

// Triggers the next page when this element scrolls into view.
export default function LoadMore({ hasMore, loading, onLoadMore }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!hasMore) return;
    const el = ref.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) onLoadMore();
      },
      // Fire 200px early, so the next page is arriving before the user
      // actually reaches the bottom.
      { rootMargin: "200px" },
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [hasMore, onLoadMore]);

  if (!hasMore) return null;

  return (
    <div ref={ref} className="py-6 text-center text-sm text-ink-400">
      {loading ? "Loading…" : "Scroll for more"}
    </div>
  );
}
