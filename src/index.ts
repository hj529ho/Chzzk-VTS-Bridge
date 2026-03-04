import { loadConfig, watchConfig } from "./config/loader.js";
import { connectVts, disconnectVts } from "./vts/client.js";
import { connectChzzk, disconnectChzzk } from "./chzzk/session.js";
import { hasTokens, hasSettings } from "./chzzk/auth.js";
import { startBridgeEngine } from "./bridge/engine.js";
import { startServer } from "./server/app.js";
import { logger } from "./utils/logger.js";

async function main(): Promise<void> {
  logger.info("Starting Chzzk-VTS Bridge...");

  // Load config
  const config = loadConfig();
  watchConfig();

  // Start bridge engine (listens to events)
  startBridgeEngine();

  // Start web dashboard
  await startServer();

  // Connect to VTuber Studio
  try {
    await connectVts();
    logger.info("VTuber Studio connection initiated");
  } catch (e) {
    logger.warn({ err: e }, "VTuber Studio not available yet - connect when ready");
  }

  // Connect to Chzzk if settings + tokens exist
  if (hasSettings() && hasTokens()) {
    try {
      await connectChzzk();
    } catch (e) {
      logger.warn({ err: e }, "Chzzk connection failed");
    }
  } else {
    logger.info("Chzzk not configured - use dashboard to set up");
  }

  logger.info(`Dashboard ready at http://localhost:${config.server.port}`);

  // Graceful shutdown
  const shutdown = async () => {
    logger.info("Shutting down...");
    await disconnectChzzk();
    await disconnectVts();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((e) => {
  logger.fatal({ err: e }, "Fatal error");
  process.exit(1);
});
