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

// 동시 던지기: 첫 throw가 원위치 저장, 마지막 throw가 복귀
let throwsInFlight = 0;
let homePos: { x: number; y: number; rotation: number; size: number } | null = null;

export async function throwItem(
  fileName: string,
  options: { size?: number; throwSpeed?: number; modelShake?: number; duration?: number; targetOffsetY?: number },
): Promise<void> {
  const client = getVtsClient();
  if (!client?.isConnected) {
    logger.warn("VTS not connected, skipping throw");
    return;
  }

  const speed = options.throwSpeed ?? 0.5;
  const shake = options.modelShake ?? 15;
  const duration = options.duration ?? 3000;
  const size = options.size ?? 0.15;

  try {
    // 첫 throw만 원위치 저장 (복귀용)
    throwsInFlight++;
    if (!homePos) {
      const info = await client.currentModel();
      const p = info.modelPosition;
      homePos = { x: p.positionX, y: p.positionY, rotation: p.rotation, size: p.size };
    }
    const home = { ...homePos };

    // 각 throw는 현재 모델 위치를 향해 날아감
    const modelInfo = await client.currentModel();
    const mp = modelInfo.modelPosition;
    const mx = mp.positionX;
    const my = mp.positionY;
    const s = Math.max(home.size + 100, 10) / 100;
    const offsetY = options.targetOffsetY ?? 0.4;

    logger.info({ modelSize: home.size, scale: s, mx, my, inFlight: throwsInFlight }, "Throw: model info");

    // Helper: local offset → world coords (everything scales with model)
    const toWorld = (lx: number, ly: number) => ({
      x: mx + lx * s,
      y: my + ly * s,
    });

    // Target: model center + head offset (in local coords)
    const target = toWorld(
      (Math.random() - 0.5) * 0.12,
      offsetY,
    );

    // Start: off-screen (upper arc, in local coords)
    const angle = (Math.random() * 0.6 + 0.2) * Math.PI;
    const startLocal = { x: Math.cos(angle) * 3.6, y: 3.0 + Math.random() * 1.0 };
    const start = toWorld(startLocal.x, startLocal.y);

    // 1. Load item off-screen (size also scales with model)
    const scaledSize = size * s;
    const res = await client.itemLoad({
      fileName,
      positionX: start.x,
      positionY: start.y,
      size: scaledSize,
      unloadWhenPluginDisconnects: true,
    });
    const instanceID = res.instanceID;
    logger.info({ fileName, instanceID, scaledSize, scale: s }, "Throw: item loaded");

    // 2. Fly toward head — spin + accelerate
    client.itemMove({
      itemsToMove: [{
        itemInstanceID: instanceID,
        timeInSeconds: speed,
        fadeMode: "easeIn",
        positionX: target.x,
        positionY: target.y,
        rotation: (Math.random() > 0.5 ? 1 : -1) * (900 + Math.random() * 540),
      }],
    }).catch(() => {});

    // 3. Wait for impact
    await new Promise((r) => setTimeout(r, speed * 920));

    // 4. Impact shake → 원위치 복귀
    const shakeDir = startLocal.x > 0 ? -1 : 1;
    client.moveModel({
      timeInSeconds: 0.05,
      valuesAreRelativeToModel: true,
      positionX: shakeDir * shake * 0.27,
      positionY: -shake * 0.13,
    }).catch(() => {});

    await new Promise((r) => setTimeout(r, 60));

    // 저장된 원위치로 복귀 (절대좌표)
    client.moveModel({
      timeInSeconds: 0.4,
      valuesAreRelativeToModel: false,
      positionX: home.x,
      positionY: home.y,
      rotation: home.rotation,
      size: home.size,
    }).catch(() => {});

    // 5. Bounce: 머리 맞고 거의 수직으로 튕겨올라간 뒤 포물선 낙하
    // ±20도 정도의 살짝 기울어진 방향
    const bounceAngle = ((Math.random() > 0.5 ? 1 : -1) * (10 + Math.random() * 10)) * Math.PI / 180;
    const bouncePower = 0.6 + Math.random() * 0.2;

    // Phase 1: 위로 튕겨오름 (easeOut — 감속하며 올라감)
    const apex = toWorld(
      Math.sin(bounceAngle) * bouncePower * 0.5,
      offsetY + bouncePower,
    );
    client.itemMove({
      itemsToMove: [{
        itemInstanceID: instanceID,
        timeInSeconds: 0.5,
        fadeMode: "easeOut",
        positionX: apex.x,
        positionY: apex.y,
        rotation: (Math.random() > 0.5 ? 1 : -1) * 360,
      }],
    }).catch(() => {});

    await new Promise((r) => setTimeout(r, 500));

    // Phase 2: 포물선 낙하 (easeIn — 가속하며 떨어짐 + 회전)
    const fallEnd = toWorld(
      Math.sin(bounceAngle) * bouncePower * 1.5,
      -2.5,
    );
    client.itemMove({
      itemsToMove: [{
        itemInstanceID: instanceID,
        timeInSeconds: 0.8,
        fadeMode: "easeIn",
        positionX: fallEnd.x,
        positionY: fallEnd.y,
        rotation: (Math.random() > 0.5 ? 1 : -1) * 720,
      }],
    }).catch(() => {});

    logger.info({ fileName }, "Throw: impact + bounce done");

    // 6. Unload after bounce completes
    setTimeout(() => {
      client.itemUnload({
        unloadAllInScene: false,
        unloadAllLoadedByThisPlugin: false,
        allowUnloadingItemsLoadedByUserOrOtherPlugins: false,
        instanceIDs: [instanceID],
        fileNames: [],
      }).catch(() => {});
    }, Math.max(duration, 1000));

    // 7. 마지막 throw가 끝나면 homePos 해제
    throwsInFlight--;
    if (throwsInFlight === 0) {
      homePos = null;
    }
  } catch (e) {
    throwsInFlight--;
    if (throwsInFlight === 0) homePos = null;
    logger.error({ err: e, fileName }, "Failed to throw item");
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
