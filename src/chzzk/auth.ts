import fs from "node:fs";
import path from "node:path";
import { logger } from "../utils/logger.js";

const TOKENS_PATH = path.resolve(".tokens.json");
const SETTINGS_PATH = path.resolve("settings.json");
const AUTH_BASE = "https://openapi.chzzk.naver.com";

export interface Settings {
  clientId: string;
  clientSecret: string;
  channelId: string;
}

interface Tokens {
  accessToken: string;
  refreshToken: string;
  expiresAt: number; // Unix ms
}

let tokens: Tokens | null = null;

export function loadSettings(): Settings {
  try {
    return JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf-8"));
  } catch {
    return { clientId: "", clientSecret: "", channelId: "" };
  }
}

export function saveSettings(s: Settings): void {
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(s, null, 2), "utf-8");
}

export function hasSettings(): boolean {
  const s = loadSettings();
  return !!(s.clientId && s.clientSecret && s.channelId);
}

export function getClientCredentials() {
  const s = loadSettings();
  if (!s.clientId || !s.clientSecret) {
    throw new Error("치지직 인증 정보가 설정되지 않았습니다. 대시보드에서 설정해주세요.");
  }
  return { clientId: s.clientId, clientSecret: s.clientSecret };
}

export function getChannelId(): string {
  const s = loadSettings();
  if (!s.channelId) {
    throw new Error("치지직 채널 ID가 설정되지 않았습니다.");
  }
  return s.channelId;
}

function loadTokens(): Tokens | null {
  try {
    const data = JSON.parse(fs.readFileSync(TOKENS_PATH, "utf-8"));
    tokens = data;
    return tokens;
  } catch {
    return null;
  }
}

function saveTokens(t: Tokens): void {
  tokens = t;
  fs.writeFileSync(TOKENS_PATH, JSON.stringify(t, null, 2), "utf-8");
}

export function getAuthorizationUrl(redirectUri: string, state: string): string {
  const { clientId } = getClientCredentials();
  const params = new URLSearchParams({
    clientId,
    redirectUri,
    state,
  });
  return `https://chzzk.naver.com/account-interlock?${params}`;
}

export async function exchangeCode(code: string, state: string, redirectUri: string): Promise<Tokens> {
  const { clientId, clientSecret } = getClientCredentials();

  const res = await fetch(`${AUTH_BASE}/auth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "authorization_code",
      clientId,
      clientSecret,
      code,
      state,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token exchange failed: ${res.status} ${text}`);
  }

  const data = await res.json() as {
    content: { accessToken: string; refreshToken: string; expiresIn: number };
  };

  const t: Tokens = {
    accessToken: data.content.accessToken,
    refreshToken: data.content.refreshToken,
    expiresAt: Date.now() + data.content.expiresIn * 1000,
  };

  saveTokens(t);
  logger.info("Chzzk tokens obtained and saved");
  return t;
}

export async function refreshTokens(): Promise<Tokens> {
  const current = tokens ?? loadTokens();
  if (!current) throw new Error("No tokens to refresh");

  const { clientId, clientSecret } = getClientCredentials();

  const res = await fetch(`${AUTH_BASE}/auth/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      grantType: "refresh_token",
      refreshToken: current.refreshToken,
      clientId,
      clientSecret,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Token refresh failed: ${res.status} ${text}`);
  }

  const data = await res.json() as {
    content: { accessToken: string; refreshToken: string; expiresIn: number };
  };

  const t: Tokens = {
    accessToken: data.content.accessToken,
    refreshToken: data.content.refreshToken,
    expiresAt: Date.now() + data.content.expiresIn * 1000,
  };

  saveTokens(t);
  logger.info("Chzzk tokens refreshed");
  return t;
}

export async function getAccessToken(): Promise<string | null> {
  let t = tokens ?? loadTokens();
  if (!t) return null;

  // Refresh if expiring within 5 minutes
  if (Date.now() > t.expiresAt - 5 * 60 * 1000) {
    try {
      t = await refreshTokens();
    } catch (e) {
      logger.error({ err: e }, "Token refresh failed");
      return null;
    }
  }

  return t.accessToken;
}

export function hasTokens(): boolean {
  return !!(tokens ?? loadTokens());
}
