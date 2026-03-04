import { eventBus, type DonationEvent, type ChatEvent } from "../utils/event-bus.js";
import { getConfig } from "../config/loader.js";
import { matchDonationRules, matchChatRules } from "./rule-matcher.js";
import { executeRule, isOnCooldown } from "./action-executor.js";
import { logger } from "../utils/logger.js";

export function startBridgeEngine(): void {
  eventBus.on("chzzk:donation", async (donation: DonationEvent) => {
    logger.info(
      { nickname: donation.donatorNickname, amount: donation.payAmount, text: donation.donationText },
      "Donation event received in engine",
    );
    const config = getConfig();
    const matched = matchDonationRules(donation, config.rules);
    logger.info({ matchedCount: matched.length, totalRules: config.rules.length }, "Donation rule matching result");
    const ready = matched.filter((r) => !isOnCooldown(r.id, r.cooldown));

    if (ready.length === 0) {
      logger.info(
        { nickname: donation.donatorNickname, amount: donation.payAmount },
        "No donation rules matched or all on cooldown",
      );
      return;
    }

    for (const rule of ready) {
      logger.info(
        { ruleId: rule.id, ruleName: rule.name, amount: donation.payAmount },
        "Donation rule matched",
      );
      eventBus.emit("bridge:rule-matched", {
        ruleId: rule.id,
        ruleName: rule.name,
        trigger: donation,
      });

      executeRule(rule).catch((e) => {
        logger.error({ err: e, ruleId: rule.id }, "Rule execution failed");
      });
    }
  });

  eventBus.on("chzzk:chat", async (chat: ChatEvent) => {
    logger.info(
      { nickname: chat.nickname, content: chat.content },
      "Chat event received in engine",
    );
    const config = getConfig();
    const chatRules = config.rules.filter(r => {
      const et = r.conditions.eventType ?? "donation";
      return et === "chat" || et === "*";
    });
    logger.info(
      { totalRules: config.rules.length, chatRules: chatRules.length, ruleDetails: chatRules.map(r => ({ id: r.id, name: r.name, eventType: r.conditions.eventType, textPattern: r.conditions.textPattern })) },
      "Chat rules before matching",
    );
    const matched = matchChatRules(chat, config.rules);
    logger.info({ matchedCount: matched.length }, "Chat rule matching result");
    const ready = matched.filter((r) => !isOnCooldown(r.id, r.cooldown));

    if (ready.length === 0) {
      logger.info({ nickname: chat.nickname, content: chat.content }, "No chat rules matched or all on cooldown");
      return;
    }

    for (const rule of ready) {
      logger.info(
        { ruleId: rule.id, ruleName: rule.name, nickname: chat.nickname },
        "Chat rule matched",
      );
      eventBus.emit("bridge:rule-matched", {
        ruleId: rule.id,
        ruleName: rule.name,
        trigger: chat,
      });

      executeRule(rule).catch((e) => {
        logger.error({ err: e, ruleId: rule.id }, "Rule execution failed");
      });
    }
  });

  logger.info("Bridge engine started");
}
