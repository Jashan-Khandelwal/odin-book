import { useEffect, useState } from "react";

// Returns `value`, but only after it has stopped changing for `delay` ms.
// Stops the search box firing a request on every keystroke.
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    // setTimeout(fn, 300) means "run fn after 300ms." So each keystroke says "in 300ms, update the copy to this value."
    const timer = setTimeout(() => setDebounced(value), delay);
    // Each keystroke cancels the previous timer, so only the last one fires.
    return () => clearTimeout(timer);
    // This is the trick. Effect cleanup runs before the effect runs again. So when you type the next letter, the old timer is cancelled and a new one is started. The copy only updates when a timer survives the full 300ms, meaning you paused.
  }, [value, delay]);

  return debounced;
}
