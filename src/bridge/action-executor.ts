import type { Action, Rule } from "../config/schema.js";
import { triggerHotkey, activateExpression, loadItem, unloadItem, tintArtMesh, resetTint, throwItem } from "../vts/actions.js";
import { eventBus } from "../utils/event-bus.js";
import { logger } from "../utils/logger.js";

const cooldownMap = new Map<string, number>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isOnCooldown(ruleId: string, cooldown: number): boolean {
  if (cooldown <= 0) return false;
  const lastFired = cooldownMap.get(ruleId);
  if (!lastFired) return false;
  return Date.now() - lastFired < cooldown;
}

export interface ActionContext {
  donationAmount?: number;
}

async function executeAction(action: Action, ruleId: string, ctx: ActionContext = {}): Promise<void> {
  if (action.delay > 0) {
    await sleep(action.delay);
  }

  switch (action.type) {
    case "hotkey": {
      await triggerHotkey(action.hotkeyId);
      eventBus.emit("bridge:action-triggered", {
        ruleId,
        actionType: "hotkey",
        detail: action.hotkeyId,
      });
      break;
    }
    case "expression": {
      await activateExpression(action.expressionFile, action.active ?? true);
      eventBus.emit("bridge:action-triggered", {
        ruleId,
        actionType: "expression",
        detail: action.expressionFile,
      });
      if (action.duration) {
        setTimeout(() => {
          activateExpression(action.expressionFile, false).catch(() => {});
        }, action.duration);
      }
      break;
    }
    case "item": {
      const instanceId = await loadItem(action.fileName, {
        positionX: action.positionX,
        positionY: action.positionY,
        size: action.size,
      });
      eventBus.emit("bridge:action-triggered", {
        ruleId,
        actionType: "item",
        detail: action.fileName,
      });
      if (instanceId && action.duration) {
        setTimeout(() => {
          unloadItem(instanceId).catch(() => {});
        }, action.duration);
      }
      break;
    }
    case "throw": {
      let count = 1;
      if (action.amountPerItem > 0 && ctx.donationAmount) {
        count = Math.min(
          Math.max(1, Math.floor(ctx.donationAmount / action.amountPerItem)),
          action.maxItems,
        );
      }
      const throwOpts = {
        size: action.size,
        throwSpeed: action.throwSpeed,
        modelShake: action.modelShake,
        duration: action.duration,
        targetOffsetY: action.targetOffsetY,
      };
      // 동시에 던지되 살짝 시차 (50ms 간격)
      const throws = Array.from({ length: count }, (_, i) =>
        sleep(i * 50).then(() => throwItem(action.fileName, throwOpts)),
      );
      await Promise.all(throws);
      eventBus.emit("bridge:action-triggered", {
        ruleId,
        actionType: "throw",
        detail: `${action.fileName} x${count}`,
      });
      break;
    }
    case "tint": {
      await tintArtMesh({
        colorR: action.colorR,
        colorG: action.colorG,
        colorB: action.colorB,
        colorA: action.colorA,
        tintAll: action.tintAll,
        nameContains: action.nameContains,
      });
      eventBus.emit("bridge:action-triggered", {
        ruleId,
        actionType: "tint",
        detail: `rgba(${action.colorR},${action.colorG},${action.colorB},${action.colorA})`,
      });
      if (action.duration) {
        setTimeout(() => {
          resetTint().catch(() => {});
        }, action.duration);
      }
      break;
    }
  }
}

export async function executeRule(rule: Rule, ctx: ActionContext = {}): Promise<void> {
  if (isOnCooldown(rule.id, rule.cooldown)) {
    logger.debug({ ruleId: rule.id }, "Rule on cooldown, skipping");
    return;
  }

  cooldownMap.set(rule.id, Date.now());

  for (const action of rule.actions) {
    try {
      await executeAction(action, rule.id, ctx);
    } catch (e) {
      logger.error({ err: e, ruleId: rule.id, actionType: action.type }, "Action execution failed");
    }
  }
}
