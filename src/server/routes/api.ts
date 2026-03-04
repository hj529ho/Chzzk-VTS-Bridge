import type { FastifyInstance } from "fastify";
import { getConfig, saveConfig } from "../../config/loader.js";
import { configSchema, ruleSchema, type Rule } from "../../config/schema.js";
import { getHotkeys, getExpressions, getArtMeshes, getAvailableItems } from "../../vts/discovery.js";
import { getVtsClient } from "../../vts/client.js";
import { isChzzkConnected } from "../../chzzk/session.js";
import { hasTokens, hasSettings, loadSettings, saveSettings, type Settings } from "../../chzzk/auth.js";
import { eventBus, type DonationEvent, type ChatEvent } from "../../utils/event-bus.js";
import { executeRule } from "../../bridge/action-executor.js";
import { logger } from "../../utils/logger.js";

export async function apiRoutes(app: FastifyInstance): Promise<void> {
  // Status
  app.get("/api/status", async () => {
    const vtsClient = getVtsClient();
    return {
      vts: { connected: vtsClient?.isConnected ?? false },
      chzzk: { connected: isChzzkConnected(), authenticated: hasTokens(), configured: hasSettings() },
    };
  });

  // Settings (치지직 인증 정보)
  app.get("/api/settings", async () => {
    const s = loadSettings();
    return {
      clientId: s.clientId ? s.clientId.slice(0, 6) + "..." : "",
      clientSecret: s.clientSecret ? "****" : "",
      channelId: s.channelId,
      hasSettings: hasSettings(),
    };
  });

  app.put<{ Body: Settings }>("/api/settings", async (req) => {
    const { clientId, clientSecret, channelId } = req.body;
    saveSettings({ clientId: clientId?.trim() ?? "", clientSecret: clientSecret?.trim() ?? "", channelId: channelId?.trim() ?? "" });
    logger.info("Settings saved via dashboard");
    return { ok: true };
  });

  // Config
  app.get("/api/config", async () => {
    const config = getConfig();
    return config;
  });

  // Rules CRUD
  app.get("/api/rules", async () => {
    return getConfig().rules;
  });

  app.post<{ Body: unknown }>("/api/rules", async (req, reply) => {
    const result = ruleSchema.safeParse(req.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    const config = getConfig();
    const exists = config.rules.some((r) => r.id === result.data.id);
    if (exists) {
      return reply.status(409).send({ error: "Rule ID already exists" });
    }

    config.rules.push(result.data);
    saveConfig(config);
    return result.data;
  });

  app.put<{ Params: { id: string }; Body: unknown }>("/api/rules/:id", async (req, reply) => {
    const result = ruleSchema.safeParse(req.body);
    if (!result.success) {
      return reply.status(400).send({ error: result.error.issues });
    }

    const config = getConfig();
    const idx = config.rules.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      return reply.status(404).send({ error: "Rule not found" });
    }

    config.rules[idx] = result.data;
    saveConfig(config);
    return result.data;
  });

  app.delete<{ Params: { id: string } }>("/api/rules/:id", async (req, reply) => {
    const config = getConfig();
    const idx = config.rules.findIndex((r) => r.id === req.params.id);
    if (idx === -1) {
      return reply.status(404).send({ error: "Rule not found" });
    }

    config.rules.splice(idx, 1);
    saveConfig(config);
    return { ok: true };
  });

  // Test fire a rule
  app.post<{ Params: { id: string } }>("/api/rules/:id/test", async (req, reply) => {
    const config = getConfig();
    const rule = config.rules.find((r) => r.id === req.params.id);
    if (!rule) {
      return reply.status(404).send({ error: "Rule not found" });
    }

    executeRule(rule).catch((e) => {
      logger.error({ err: e }, "Test fire failed");
    });
    return { ok: true, ruleName: rule.name };
  });

  // Simulate donation (테스트용 가짜 후원)
  app.post<{ Body: { nickname?: string; amount?: number; text?: string; type?: string } }>(
    "/api/test-donation",
    async (req) => {
      const donation: DonationEvent = {
        channelId: "test",
        donatorChannelId: "test",
        donatorNickname: req.body.nickname || "테스트 유저",
        payAmount: req.body.amount || 1000,
        donationText: req.body.text || "테스트 후원이에요!",
        donationType: req.body.type === "VIDEO" ? "VIDEO" : "CHAT",
        timestamp: Date.now(),
      };

      logger.info({ donation }, "Test donation simulated");
      eventBus.emit("chzzk:donation", donation);
      return { ok: true };
    },
  );

  // Simulate chat (테스트용 가짜 채팅)
  app.post<{ Body: { nickname?: string; text?: string } }>(
    "/api/test-chat",
    async (req) => {
      const chat: ChatEvent = {
        channelId: "test",
        senderChannelId: "test",
        nickname: req.body.nickname || "테스트 유저",
        content: req.body.text || "테스트 채팅이에요!",
        messageTime: Date.now(),
      };

      logger.info({ chat }, "Test chat simulated");
      eventBus.emit("chzzk:chat", chat);
      return { ok: true };
    },
  );

  // VTS Discovery
  app.get("/api/vts/hotkeys", async () => getHotkeys());
  app.get("/api/vts/expressions", async () => getExpressions());
  app.get("/api/vts/artmeshes", async () => getArtMeshes());
  app.get("/api/vts/items", async () => getAvailableItems());
}
