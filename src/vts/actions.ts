import { getVtsClient } from "./client.js";
import { logger } from "../utils/logger.js";

export async function triggerHotkey(hotkeyId: string): Promise<void> {
  const client = getVtsClient();
  if (!client?.isConnected) {
    logger.warn("VTS not connected, skipping hotkey trigger");
    return;
  }

  try {
    await client.hotkeyTrigger({ hotkeyID: hotkeyId });
    logger.info({ hotkeyId }, "Hotkey triggered");
  } catch (e) {
    logger.error({ err: e, hotkeyId }, "Failed to trigger hotkey");
  }
}

export async function activateExpression(
  expressionFile: string,
  active: boolean,
): Promise<void> {
  const client = getVtsClient();
  if (!client?.isConnected) {
    logger.warn("VTS not connected, skipping expression");
    return;
  }

  try {
    await client.expressionActivation({ expressionFile, active });
    logger.info({ expressionFile, active }, "Expression toggled");
  } catch (e) {
    logger.error({ err: e, expressionFile }, "Failed to toggle expression");
  }
}

export async function loadItem(
  fileName: string,
  options: { positionX?: number; positionY?: number; size?: number },
): Promise<string | null> {
  const client = getVtsClient();
  if (!client?.isConnected) {
    logger.warn("VTS not connected, skipping item load");
    return null;
  }

  try {
    const res = await client.itemLoad({
      fileName,
      positionX: options.positionX ?? 0,
      positionY: options.positionY ?? 0,
      size: options.size ?? 0.1,
      unloadWhenPluginDisconnects: true,
    });
    logger.info({ fileName, instanceID: res.instanceID }, "Item loaded");
    return res.instanceID;
  } catch (e) {
    logger.error({ err: e, fileName }, "Failed to load item");
    return null;
  }
}

export async function unloadItem(instanceId: string): Promise<void> {
  const client = getVtsClient();
  if (!client?.isConnected) return;

  try {
    await client.itemUnload({
      unloadAllInScene: false,
      unloadAllLoadedByThisPlugin: false,
      allowUnloadingItemsLoadedByUserOrOtherPlugins: false,
      instanceIDs: [instanceId],
      fileNames: [],
    });
    logger.info({ instanceId }, "Item unloaded");
  } catch (e) {
    logger.error({ err: e, instanceId }, "Failed to unload item");
  }
}

export async function tintArtMesh(options: {
  colorR: number;
  colorG: number;
  colorB: number;
  colorA: number;
  tintAll: boolean;
  nameContains: string[];
}): Promise<void> {
  const client = getVtsClient();
  if (!client?.isConnected) {
    logger.warn("VTS not connected, skipping tint");
    return;
  }

  try {
    await client.colorTint({
      colorTint: {
        colorR: options.colorR,
        colorG: options.colorG,
        colorB: options.colorB,
        colorA: options.colorA,
      },
      artMeshMatcher: {
        tintAll: options.tintAll,
        nameContains: options.nameContains,
      },
    });
    logger.info("ArtMesh tinted");
  } catch (e) {
    logger.error({ err: e }, "Failed to tint ArtMesh");
  }
}

export async function resetTint(): Promise<void> {
  const client = getVtsClient();
  if (!client?.isConnected) return;

  try {
    await client.colorTint({
      colorTint: { colorR: 255, colorG: 255, colorB: 255, colorA: 255 },
      artMeshMatcher: { tintAll: true },
    });
  } catch {
    // best effort
  }
}
