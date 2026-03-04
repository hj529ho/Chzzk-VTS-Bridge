import { getVtsClient } from "./client.js";
import { logger } from "../utils/logger.js";

export interface VtsHotkey {
  name: string;
  hotkeyID: string;
  type: string;
  file: string;
}

export interface VtsExpression {
  name: string;
  file: string;
  active: boolean;
}

export async function getHotkeys(): Promise<VtsHotkey[]> {
  const client = getVtsClient();
  if (!client?.isConnected) return [];

  try {
    const res = await client.hotkeysInCurrentModel({});
    return res.availableHotkeys.map((h) => ({
      name: h.name,
      hotkeyID: h.hotkeyID,
      type: String(h.type),
      file: h.file,
    }));
  } catch (e) {
    logger.error({ err: e }, "Failed to get hotkeys");
    return [];
  }
}

export async function getExpressions(): Promise<VtsExpression[]> {
  const client = getVtsClient();
  if (!client?.isConnected) return [];

  try {
    const res = await client.expressionState({ details: false });
    return res.expressions.map((e) => ({
      name: e.name,
      file: e.file,
      active: e.active,
    }));
  } catch (e) {
    logger.error({ err: e }, "Failed to get expressions");
    return [];
  }
}

export async function getArtMeshes(): Promise<{ names: string[]; tags: string[] }> {
  const client = getVtsClient();
  if (!client?.isConnected) return { names: [], tags: [] };

  try {
    const res = await client.artMeshList();
    return { names: res.artMeshNames, tags: res.artMeshTags };
  } catch (e) {
    logger.error({ err: e }, "Failed to get art meshes");
    return { names: [], tags: [] };
  }
}

export async function getAvailableItems(): Promise<{ fileName: string }[]> {
  const client = getVtsClient();
  if (!client?.isConnected) return [];

  try {
    const res = await client.itemList({
      includeAvailableSpots: false,
      includeItemInstancesInScene: false,
      includeAvailableItemFiles: true,
    });
    return res.availableItemFiles.map((f) => ({ fileName: f.fileName }));
  } catch (e) {
    logger.error({ err: e }, "Failed to get items");
    return [];
  }
}
