import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "../lib/api";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      // ?limit=1 because we only want the unreadCount field — the endpoint returns it alongside the page, so one row is the cheapest way to ask.
      const data = await api.get("/notifications?limit=1");
      setUnreadCount(data.unreadCount);
    } catch {
      // A failed badge refresh is not worth surfacing to the user.
    }
  }, [user]);

  // Poll while signed in. Phase 10B replaces this with a socket push.
  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      return;
    }
    refresh();
    const timer = setInterval(refresh, 30_000);
    return () => clearInterval(timer);
  }, [user, refresh]);

  const value = { unreadCount, setUnreadCount, refresh };
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
