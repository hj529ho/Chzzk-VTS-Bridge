import type { FastifyInstance } from "fastify";
import { eventBus } from "../../utils/event-bus.js";
import type WebSocket from "ws";

const clients = new Set<WebSocket>();

function broadcast(type: string, data: unknown): void {
  const msg = JSON.stringify({ type, data, timestamp: Date.now() });
  for (const ws of clients) {
    if (ws.readyState === 1) {
      ws.send(msg);
    }
  }
}

export async function websocketRoutes(app: FastifyInstance): Promise<void> {
  app.get("/ws", { websocket: true }, (socket) => {
    clients.add(socket);
    socket.on("close", () => clients.delete(socket));
  });

  // Forward events to dashboard
  eventBus.on("chzzk:connected", () => broadcast("chzzk:connected", {}));
  eventBus.on("chzzk:disconnected", () => broadcast("chzzk:disconnected", {}));
  eventBus.on("vts:connected", () => broadcast("vts:connected", {}));
  eventBus.on("vts:disconnected", () => broadcast("vts:disconnected", {}));
  eventBus.on("chzzk:donation", (donation) => broadcast("chzzk:donation", donation));
  eventBus.on("chzzk:chat", (chat) => broadcast("chzzk:chat", chat));
  eventBus.on("bridge:rule-matched", (data) => broadcast("bridge:rule-matched", data));
  eventBus.on("bridge:action-triggered", (data) => broadcast("bridge:action-triggered", data));
}
