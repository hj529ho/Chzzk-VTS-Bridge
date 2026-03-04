import type { FastifyInstance } from "fastify";
import crypto from "node:crypto";
import { getAuthorizationUrl, exchangeCode } from "../../chzzk/auth.js";
import { connectChzzk } from "../../chzzk/session.js";
import { logger } from "../../utils/logger.js";

const stateStore = new Map<string, number>();

export async function authRoutes(app: FastifyInstance): Promise<void> {
  // Start OAuth flow
  app.get("/auth/chzzk", async (_req, reply) => {
    const state = crypto.randomBytes(16).toString("hex");
    stateStore.set(state, Date.now());

    const serverPort = (app.server.address() as { port: number })?.port ?? 3000;
    const redirectUri = `http://localhost:${serverPort}/auth/callback`;
    const url = getAuthorizationUrl(redirectUri, state);

    return reply.redirect(url);
  });

  // OAuth callback
  app.get<{
    Querystring: { code?: string; state?: string };
  }>("/auth/callback", async (req, reply) => {
    const { code, state } = req.query;

    if (!code || !state) {
      return reply.status(400).send({ error: "Missing code or state" });
    }

    if (!stateStore.has(state)) {
      return reply.status(400).send({ error: "Invalid state" });
    }
    stateStore.delete(state);

    try {
      const serverPort = (app.server.address() as { port: number })?.port ?? 3000;
      const redirectUri = `http://localhost:${serverPort}/auth/callback`;
      await exchangeCode(code, state, redirectUri);

      // Auto-connect after auth
      connectChzzk().catch((e) => {
        logger.error({ err: e }, "Auto-connect after OAuth failed");
      });

      return reply.type("text/html; charset=utf-8").send(`
        <!DOCTYPE html>
        <html><head><meta charset="UTF-8"></head>
        <body style="font-family:sans-serif;text-align:center;padding:60px">
          <h2>치지직 연동 완료!</h2>
          <p>이 창은 자동으로 닫혀요.</p>
          <script>setTimeout(()=>window.close(),2000)</script>
        </body></html>
      `);
    } catch (e) {
      logger.error({ err: e }, "OAuth callback failed");
      return reply.status(500).send({ error: "Authentication failed" });
    }
  });
}
