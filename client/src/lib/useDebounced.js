import { useEffect, useState } from "react";

// Returns `value`, but only after it has stopped changing for `delay` ms.
// Stops the search box firing a request on every keystroke.
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    // Each keystroke cancels the previous timer, so only the last one fires.
    return () => clearTimeout(timer);
  }, [value, delay]);

  return debounced;
}
