import { z } from 'zod';

/** Guild + events tuning (M16), written by scripts/import-guild-events.mjs. */
const line = z.object({ kind: z.enum(['core', 'percent']), field: z.string().min(1), value: z.number() }).strict();
const rewards = z.record(z.string(), z.number());
export const guildEventsSchema = z
  .object({
    guild: z
      .object({
        donateTimes: z.number().int().positive(),
        donations: z
          .object({
            normal: z.object({ costGold: z.number(), guildCoin: z.number(), exp: z.number(), fund: z.number() }).strict(),
            gems: z.object({ costGems: z.number(), guildCoin: z.number(), exp: z.number(), fund: z.number() }).strict(),
          })
          .strict(),
        levels: z.array(z.object({ level: z.number().int(), exp: z.number(), members: z.number().int() }).strict()).min(1),
        redPackets: z.array(z.object({ id: z.number().int(), trainerLevel: z.number().int(), gems: z.number(), shares: z.number().int() }).strict()),
        beast: z
          .object({
            levels: z.array(z.object({ level: z.number().int(), star: z.number().int(), exp: z.number(), lines: z.array(line) }).strict()).min(2),
            foods: z.array(z.object({ itemId: z.number().int(), currency: z.string(), exp: z.number(), guildCoin: z.number() }).strict()),
          })
          .strict(),
        cpuMembers: z.number().int(),
        cpuExpPerMemberDay: z.number(),
      })
      .strict(),
    shovel: z
      .object({
        cycleDays: z.number().int().positive(),
        lengthDays: z.number().int().positive(),
        firstServerDay: z.number().int().positive(),
        creditsPerShovel: z.number(),
        pool: z.object({ start: z.number(), perDraw: z.number() }).strict(),
        wheel: z.array(z.object({ id: z.string(), poolPct: z.number().optional(), odds: z.number().optional(), rewards: rewards.optional(), note: z.string().optional() }).strict()).min(2),
        milestones: z.array(z.object({ credits: z.number(), rewards }).strict()),
        shop: z.array(z.object({ price: z.number(), perDay: z.number().int() }).strict()),
        exchange: z.array(z.object({ id: z.number().int(), name: z.string(), price: z.number(), limit: z.number().int(), rewards }).strict()),
      })
      .strict(),
    merge: z
      .object({
        firstServerDay: z.number().int().positive(),
        cycleDays: z.number().int().positive(),
        phases: z.array(z.object({ id: z.string(), currency: z.string(), perPoint: z.number().positive() }).strict()).length(4),
        rankRewards: z.array(z.object({ rank: z.number().int(), rewards }).strict()),
        cpuTop: z.number(),
      })
      .strict(),
  })
  .strict();
export type GuildEventsJson = z.infer<typeof guildEventsSchema>;
