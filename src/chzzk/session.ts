import io from "socket.io-client";
import { logger } from "../utils/logger.js";
import { eventBus, type DonationEvent, type ChatEvent } from "../utils/event-bus.js";
import { getAccessToken } from "./auth.js";

const API_BASE = "https://openapi.chzzk.naver.com";

let socket: ReturnType<typeof io> | null = null;
let sessionKey: string | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

async function getSessionUrl(): Promise<string> {
  const token = await getAccessToken();
  if (!token) throw new Error("치지직 로그인이 필요합니다");

  const res = await fetch(`${API_BASE}/open/v1/sessions/auth`, {
    headers: {
      "Authorization": `Bearer ${token}`,
    },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Session auth failed: ${res.status} ${text}`);
  }

  const data = await res.json();
  logger.info({ sessionAuthResponse: data }, "Chzzk session auth response");

  const url = typeof data.content === "string"
    ? data.content
    : data.content?.url ?? data.content?.sessionUrl ?? data.url;

  if (!url) {
    throw new Error(`Unexpected session auth response: ${JSON.stringify(data)}`);
  }
  return url;
}

async function subscribeDonation(): Promise<void> {
  if (!sessionKey) throw new Error("No session key");

  const token = await getAccessToken();
  if (!token) throw new Error("치지직 로그인이 필요합니다");

  const res = await fetch(
    `${API_BASE}/open/v1/sessions/events/subscribe/donation?sessionKey=${sessionKey}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Donation subscribe failed: ${res.status} ${text}`);
  }

  logger.info("Subscribed to donation events");
}

async function subscribeChat(): Promise<void> {
  if (!sessionKey) throw new Error("No session key");

  const token = await getAccessToken();
  if (!token) throw new Error("치지직 로그인이 필요합니다");

  const res = await fetch(
    `${API_BASE}/open/v1/sessions/events/subscribe/chat?sessionKey=${sessionKey}`,
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    },
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Chat subscribe failed: ${res.status} ${text}`);
  }

  logger.info("Subscribed to chat events");
}

function scheduleReconnect(): void {
  if (reconnectTimer) return;
  reconnectTimer = setTimeout(async () => {
    reconnectTimer = null;
    logger.info("Attempting Chzzk reconnection...");
    try {
      await connectChzzk();
    } catch (e) {
      logger.error({ err: e }, "Reconnection failed, retrying in 10s");
      scheduleReconnect();
    }
  }, 10_000);
}

export async function connectChzzk(): Promise<void> {
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  const sessionUrl = await getSessionUrl();
  logger.info("Connecting to Chzzk session...");

  socket = io(sessionUrl, {
    reconnection: false,
    "force new connection": true,
    timeout: 3000,
    transports: ["websocket"],
  } as Parameters<typeof io>[1]);

  socket.on("connect", () => {
    logger.info("Chzzk socket connected");
  });

  // Chzzk sends "SYSTEM" and "EVENT" as Socket.IO event names, not "message"
  socket.on("SYSTEM", (raw: string) => {
    try {
      const msg = JSON.parse(raw);
      logger.info({ systemMsg: msg }, "Chzzk SYSTEM event");

      if (msg.type === "connected") {
        sessionKey = msg.data?.sessionKey;
        logger.info({ sessionKey }, "Chzzk session established");
        Promise.all([
          subscribeDonation(),
          subscribeChat(),
        ]).then(() => {
          eventBus.emit("chzzk:connected");
        }).catch((e) => {
          logger.error({ err: e }, "Failed to subscribe to events");
        });
      } else if (msg.type === "subscribed") {
        logger.info("Donation subscription confirmed");
      }
    } catch (e) {
      logger.error({ err: e, raw }, "Failed to parse Chzzk SYSTEM message");
    }
  });

  socket.on("DONATION", (raw: string) => {
    try {
      const d = typeof raw === "string" ? JSON.parse(raw) : raw;
      logger.info({ raw: String(raw).slice(0, 500) }, "Chzzk DONATION event raw");

      const donation: DonationEvent = {
        channelId: d.channelId ?? "",
        donatorChannelId: d.donatorChannelId ?? "",
        donatorNickname: d.donatorNickname ?? "익명",
        payAmount: Number(d.payAmount) || 0,
        donationText: d.donationText ?? "",
        donationType: d.donationType === "VIDEO" ? "VIDEO" : "CHAT",
        timestamp: Date.now(),
      };

      logger.info(
        { nickname: donation.donatorNickname, amount: donation.payAmount },
        "Donation received",
      );
      eventBus.emit("chzzk:donation", donation);
    } catch (e) {
      logger.error({ err: e, raw }, "Failed to parse Chzzk DONATION event");
    }
  });

  socket.on("CHAT", (raw: string) => {
    try {
      const d = typeof raw === "string" ? JSON.parse(raw) : raw;
      logger.info({ raw: String(raw).slice(0, 500) }, "Chzzk CHAT event raw");

      const chat: ChatEvent = {
        channelId: d.channelId ?? "",
        senderChannelId: d.senderChannelId ?? "",
        nickname: d.profile?.nickname ?? "익명",
        content: d.content ?? "",
        messageTime: d.messageTime ?? Date.now(),
      };

      logger.info(
        { nickname: chat.nickname, content: chat.content },
        "Chat received",
      );
      eventBus.emit("chzzk:chat", chat);
    } catch (e) {
      logger.error({ err: e, raw }, "Failed to parse Chzzk CHAT event");
    }
  });

  socket.on("disconnect", () => {
    logger.warn("Chzzk socket disconnected");
    sessionKey = null;
    eventBus.emit("chzzk:disconnected");
    scheduleReconnect();
  });

  socket.on("error", (err: unknown) => {
    logger.error({ err }, "Chzzk socket error");
  });
}

export async function disconnectChzzk(): Promise<void> {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (socket) {
    socket.disconnect();
    socket = null;
  }
  sessionKey = null;
}

export function isChzzkConnected(): boolean {
  return socket?.connected === true && sessionKey !== null;
}
