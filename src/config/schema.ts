import { z } from "zod";

const hotkeyAction = z.object({
  type: z.literal("hotkey"),
  hotkeyId: z.string(),
  delay: z.number().min(0).default(0),
});

const expressionAction = z.object({
  type: z.literal("expression"),
  expressionFile: z.string(),
  active: z.boolean().default(true),
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).default(0),
});

const itemAction = z.object({
  type: z.literal("item"),
  fileName: z.string(),
  positionX: z.number().default(0),
  positionY: z.number().default(0),
  size: z.number().min(0).default(0.1),
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).default(0),
});

const tintAction = z.object({
  type: z.literal("tint"),
  colorR: z.number().min(0).max(255).default(255),
  colorG: z.number().min(0).max(255).default(255),
  colorB: z.number().min(0).max(255).default(255),
  colorA: z.number().min(0).max(255).default(255),
  nameContains: z.array(z.string()).default([]),
  tintAll: z.boolean().default(false),
  duration: z.number().min(0).optional(),
  delay: z.number().min(0).default(0),
});

export const actionSchema = z.discriminatedUnion("type", [
  hotkeyAction,
  expressionAction,
  itemAction,
  tintAction,
]);

export const ruleSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean().default(true),
  conditions: z.object({
    eventType: z.enum(["donation", "chat", "*"]).default("donation"),
    minAmount: z.number().min(0).optional(),
    maxAmount: z.number().min(0).optional(),
    donationType: z.enum(["CHAT", "VIDEO", "*"]).default("*"),
    textPattern: z.string().optional(),
    nicknamePattern: z.string().optional(),
  }),
  actions: z.array(actionSchema).min(1),
  cooldown: z.number().min(0).default(0),
});

export const configSchema = z.object({
  vts: z.object({
    host: z.string().default("localhost"),
    port: z.number().default(8001),
    pluginName: z.string().default("Chzzk Donation Bridge"),
    pluginDeveloper: z.string().default("User"),
  }),
  server: z.object({
    port: z.number().default(3000),
  }),
  rules: z.array(ruleSchema).default([]),
});

export type Config = z.infer<typeof configSchema>;
export type Rule = z.infer<typeof ruleSchema>;
export type Action = z.infer<typeof actionSchema>;
