import fs from "node:fs";
import path from "node:path";
import { configSchema, type Config } from "./schema.js";
import { logger } from "../utils/logger.js";
import { eventBus } from "../utils/event-bus.js";
import { APP_DIR } from "../utils/paths.js";

const CONFIG_PATH = path.join(APP_DIR, "config.json");

let currentConfig: Config | null = null;

const DEFAULT_CONFIG = {
  vts: { host: "localhost", port: 8001, pluginName: "Chzzk Donation Bridge", pluginDeveloper: "User" },
  server: { port: 3000 },
  rules: [],
};

export function loadConfig(): Config {
  if (!fs.existsSync(CONFIG_PATH)) {
    const defaults = configSchema.parse(DEFAULT_CONFIG);
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(defaults, null, 2), "utf-8");
    logger.info("Created default config.json");
    currentConfig = defaults;
    return defaults;
  }

  const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
  const config = configSchema.parse(raw);
  currentConfig = config;
  return config;
}

export function getConfig(): Config {
  if (!currentConfig) return loadConfig();
  return currentConfig;
}

export function saveConfig(config: Config): void {
  const validated = configSchema.parse(config);
  const tmpPath = CONFIG_PATH + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(validated, null, 2), "utf-8");
  fs.renameSync(tmpPath, CONFIG_PATH);
  currentConfig = validated;
  logger.info("Config saved");
}

export function watchConfig(): void {
  let debounce: ReturnType<typeof setTimeout> | null = null;

  fs.watch(CONFIG_PATH, () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(() => {
      try {
        const raw = JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
        const config = configSchema.parse(raw);
        currentConfig = config;
        eventBus.emit("config:reloaded");
        logger.info("Config reloaded from file change");
      } catch (e) {
        logger.error({ err: e }, "Config reload failed, keeping previous config");
      }
    }, 500);
  });
}
