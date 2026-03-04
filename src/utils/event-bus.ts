import { EventEmitter } from "node:events";

export interface BridgeEvents {
  "chzzk:connected": [];
  "chzzk:disconnected": [];
  "chzzk:donation": [donation: DonationEvent];
  "chzzk:chat": [chat: ChatEvent];
  "vts:connected": [];
  "vts:disconnected": [];
  "bridge:rule-matched": [data: { ruleId: string; ruleName: string; trigger: DonationEvent | ChatEvent }];
  "bridge:action-triggered": [data: { ruleId: string; actionType: string; detail: string }];
  "config:reloaded": [];
}

export interface DonationEvent {
  channelId: string;
  donatorChannelId: string;
  donatorNickname: string;
  payAmount: number;
  donationText: string;
  donationType: "CHAT" | "VIDEO";
  timestamp: number;
}

export interface ChatEvent {
  channelId: string;
  senderChannelId: string;
  nickname: string;
  content: string;
  messageTime: number;
}

class TypedEventEmitter extends EventEmitter {
  override emit<K extends keyof BridgeEvents>(event: K, ...args: BridgeEvents[K]): boolean {
    return super.emit(event, ...args);
  }

  override on<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this {
    return super.on(event, listener as (...args: unknown[]) => void);
  }

  override off<K extends keyof BridgeEvents>(event: K, listener: (...args: BridgeEvents[K]) => void): this {
    return super.off(event, listener as (...args: unknown[]) => void);
  }
}

export const eventBus = new TypedEventEmitter();
