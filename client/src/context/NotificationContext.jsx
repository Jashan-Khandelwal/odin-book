import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { api } from "../lib/api";
import { connectSocket, disconnectSocket } from "../lib/socket";
import { useAuth } from "./AuthContext";

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user } = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);
  // The most recent pushed notification, for the toast.
  const [latest, setLatest] = useState(null);

  const refresh = useCallback(async () => {
    if (!user) return;
    try {
      const data = await api.get("/notifications?limit=1");
      setUnreadCount(data.unreadCount);
    } catch {
      // A failed badge refresh isn't worth showing the user.
    }
  }, [user]);

  useEffect(() => {
    if (!user) {
      setUnreadCount(0);
      setLatest(null);
      disconnectSocket();
      return;
    }

    refresh();

    const socket = connectSocket();

    const onNew = ({ notification, unreadCount: count }) => {
      setUnreadCount(count);
      setLatest(notification);
    };
    const onSync = ({ unreadCount: count }) => setUnreadCount(count);

    socket.on("notification:new", onNew);
    socket.on("notification:sync", onSync);

    // Fallback poll. If the socket is down — a proxy that blocks upgrades,
    // a flaky network — the badge still catches up within a minute.
    const timer = setInterval(refresh, 60_000);

    return () => {
      socket.off("notification:new", onNew);
      socket.off("notification:sync", onSync);
      clearInterval(timer);
      // Disconnecting here means signing in as someone else opens a fresh
      // socket carrying the new token.
      disconnectSocket();
    };
  }, [user, refresh]);

  const value = { unreadCount, setUnreadCount, refresh, latest, setLatest };
  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}

// import {
//   createContext,
//   useCallback,
//   useContext,
//   useEffect,
//   useState,
// } from "react";
// import { api } from "../lib/api";
// import { useAuth } from "./AuthContext";

// const NotificationContext = createContext(null);

// export function NotificationProvider({ children }) {
//   const { user } = useAuth();
//   const [unreadCount, setUnreadCount] = useState(0);

//   const refresh = useCallback(async () => {
//     if (!user) return;
//     try {
//       // ?limit=1 because we only want the unreadCount field — the endpoint returns it alongside the page, so one row is the cheapest way to ask.
//       const data = await api.get("/notifications?limit=1");
//       setUnreadCount(data.unreadCount);
//     } catch {
//       // A failed badge refresh is not worth surfacing to the user.
//     }
//   }, [user]);

//   // Poll while signed in. Phase 10B replaces this with a socket push.
//   useEffect(() => {
//     if (!user) {
//       setUnreadCount(0);
//       return;
//     }
//     refresh();
//     const timer = setInterval(refresh, 30_000);
//     return () => clearInterval(timer);
//   }, [user, refresh]);

//   const value = { unreadCount, setUnreadCount, refresh };
//   return (
//     <NotificationContext.Provider value={value}>
//       {children}
//     </NotificationContext.Provider>
//   );
// }

// export function useNotifications() {
//   return useContext(NotificationContext);
// }
