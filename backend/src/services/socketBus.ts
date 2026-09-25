import type { Server } from "socket.io";
let server: Server | null = null;
export function setSocketServer(value: Server) { server = value; }
export function emitEvent(event: string, payload: unknown) { server?.emit(event, payload); }
