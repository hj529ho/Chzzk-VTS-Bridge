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

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function startServer(): Promise<void> {
  const config = getConfig();

  const app = Fastify({ logger: false });

  await app.register(fastifyWebsocket);
  await app.register(fastifyStatic, {
    root: path.join(__dirname, "static"),
    prefix: "/",
  });

  await app.register(authRoutes);
  await app.register(apiRoutes);
  await app.register(websocketRoutes);

  await app.listen({ port: config.server.port, host: "0.0.0.0" });
  logger.info({ port: config.server.port }, `Dashboard: http://localhost:${config.server.port}`);
}
