import { io, type Socket } from "socket.io-client";

const SOCKET_URL = (import.meta.env.VITE_SOCKET_URL as string | undefined) ?? "http://localhost:6001";
let socket: Socket | null = null;
export function getSocket() {
  if (!socket) socket = io(SOCKET_URL, { autoConnect: false, reconnectionAttempts: 5, timeout: 5000, transports: ["websocket", "polling"] });
  return socket;
}
