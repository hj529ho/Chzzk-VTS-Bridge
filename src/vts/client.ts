import fs from "node:fs";
import path from "node:path";
import WebSocket from "ws";
import { ApiClient } from "vtubestudio";
import { logger } from "../utils/logger.js";
import { eventBus } from "../utils/event-bus.js";
import { getConfig } from "../config/loader.js";
import { APP_DIR } from "../utils/paths.js";

const TOKEN_PATH = path.join(APP_DIR, ".vts-token");

let apiClient: ApiClient | null = null;

function readToken(): string | null {
  try {
    return fs.readFileSync(TOKEN_PATH, "utf-8").trim() || null;
  } catch {
    return null;
  }
}

async function writeToken(token: string): Promise<void> {
  fs.writeFileSync(TOKEN_PATH, token, "utf-8");
}

export function getVtsClient(): ApiClient | null {
  return apiClient;
}

export async function connectVts(): Promise<ApiClient> {
  const config = getConfig();
  const url = `ws://${config.vts.host}:${config.vts.port}`;

  apiClient = new ApiClient({
    authTokenGetter: () => readToken(),
    authTokenSetter: (token) => writeToken(token),
    pluginName: config.vts.pluginName,
    pluginDeveloper: config.vts.pluginDeveloper,
    url,
    webSocketFactory: (wsUrl) => new WebSocket(wsUrl) as unknown as globalThis.WebSocket,
  });

  apiClient.on("connect", async () => {
    logger.info("VTuber Studio connected and authenticated");
    eventBus.emit("vts:connected");

    // Subscribe to model change events
    try {
      await apiClient!.events.modelLoaded.subscribe((_data) => {
        logger.info("VTS model changed, refreshing data");
        eventBus.emit("vts:connected"); // re-trigger so dashboard reloads hotkeys/expressions
      }, {});
    } catch (e) {
      logger.warn({ err: e }, "Could not subscribe to model change events");
    }
  });

  apiClient.on("disconnect", () => {
    logger.warn("VTuber Studio disconnected");
    eventBus.emit("vts:disconnected");
  });

  apiClient.on("error", (err) => {
    logger.error({ err }, "VTuber Studio error");
  });

  return apiClient;
}

export async function disconnectVts(): Promise<void> {
  if (apiClient) {
    apiClient.disconnect();
    apiClient = null;
  }
}
