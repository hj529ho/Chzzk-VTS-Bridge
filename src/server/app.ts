import path from "node:path";
import { fileURLToPath } from "node:url";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyWebsocket from "@fastify/websocket";
import { authRoutes } from "./routes/auth.js";
import { apiRoutes } from "./routes/api.js";
import { websocketRoutes } from "./routes/websocket.js";
import { logger } from "../utils/logger.js";
import { getConfig } from "../config/loader.js";

import { APP_DIR } from "../utils/paths.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startServer(): Promise<void> {
  const config = getConfig();

  // pkg exe: exe 옆 static/, 개발: src/server/static/
  const staticRoot = (process as any).pkg
    ? path.join(APP_DIR, "static")
    : path.join(__dirname, "static");

  const app = Fastify({ logger: false });

  await app.register(fastifyWebsocket);
  await app.register(fastifyStatic, {
    root: staticRoot,
    prefix: "/",
  });

  await app.register(authRoutes);
  await app.register(apiRoutes);
  await app.register(websocketRoutes);

  await app.listen({ port: config.server.port, host: "0.0.0.0" });
  logger.info({ port: config.server.port }, `Dashboard: http://localhost:${config.server.port}`);
}
