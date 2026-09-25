import { io } from "socket.io-client";
import { getToken } from "./api";

// Socket.io connects to the server root, not to /api/v1.
const SOCKET_URL = import.meta.env.VITE_API_URL.replace(/\/api\/v1\/?$/, "");

let socket = null;

export function connectSocket() {
  if (socket) return socket;
  socket = io(SOCKET_URL, {
    // Read at connect time, so a fresh login uses the fresh token.
    auth: { token: getToken() },
  });
  return socket;
}

export function disconnectSocket() {
  if (!socket) return;
  socket.disconnect();
  socket = null;
}
