import type { Rule } from "../config/schema.js";
import type { DonationEvent, ChatEvent } from "../utils/event-bus.js";
import { logger } from "../utils/logger.js";

export function matchDonationRules(donation: DonationEvent, rules: Rule[]): Rule[] {
  return rules.filter((rule) => {
    if (!rule.enabled) return false;

    const { conditions } = rule;
    const et = conditions.eventType ?? "donation";
    if (et !== "donation" && et !== "*") return false;

    if (conditions.minAmount !== undefined && donation.payAmount < conditions.minAmount) {
      return false;
    }

    if (conditions.maxAmount !== undefined && donation.payAmount > conditions.maxAmount) {
      return false;
    }

    if (conditions.donationType !== "*" && conditions.donationType !== donation.donationType) {
      return false;
    }

    if (conditions.textPattern) {
      try {
        const regex = new RegExp(conditions.textPattern, "i");
        if (!regex.test(donation.donationText)) return false;
      } catch {
        return false;
      }
    }

    return true;
  });
}

export function matchChatRules(chat: ChatEvent, rules: Rule[]): Rule[] {
  return rules.filter((rule) => {
    if (!rule.enabled) return false;

    const { conditions } = rule;
    const et = conditions.eventType ?? "donation";
    if (et !== "chat" && et !== "*") return false;

    if (conditions.textPattern) {
      try {
        const regex = new RegExp(conditions.textPattern, "i");
        const matched = regex.test(chat.content);
        logger.info(
          { ruleName: rule.name, pattern: conditions.textPattern, content: chat.content, matched,
            patternCodes: [...conditions.textPattern].map(c => c.charCodeAt(0)),
            contentCodes: [...chat.content].slice(0, 20).map(c => c.charCodeAt(0)) },
          "Chat textPattern match debug",
        );
        if (!matched) return false;
      } catch {
        return false;
      }
    }

    if (conditions.nicknamePattern) {
      try {
        const regex = new RegExp(conditions.nicknamePattern, "i");
        if (!regex.test(chat.nickname)) return false;
      } catch {
        return false;
      }
    }

    return true;
  });
}
