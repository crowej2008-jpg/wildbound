import { z } from 'zod';

/** Pokémon Park tuning, written by scripts/import-park.mjs. */
const rewards = z.record(z.string(), z.number());
const rank = z.object({ rank: z.number().int(), rewards }).strict();
export const parkSchema = z
  .object({
    hours: z.tuple([z.number(), z.number()]),
    stamina: z.object({ perDay: z.number(), move: z.number(), explore: z.number(), skip: z.number() }).strict(),
    explore: z.object({ wildWeight: z.number(), eggWeight: z.number() }).strict(),
    eggs: z.object({ bag: z.number().int(), perRefresh: z.number().int(), refreshHours: z.array(z.number()), hatchMinutes: z.number(), rewards, points: z.number() }).strict(),
    collapseHours: z.array(z.number()),
    boss: z.object({ windows: z.array(z.tuple([z.number(), z.number()])), minutes: z.number(), rounds: z.number().int(), battleScore: z.number(), joinReward: rewards, hp: z.number(), cpuDamagePerMinute: z.number() }).strict(),
    score: z.object({ wildWin: z.number(), wildLoss: z.number() }).strict(),
    map: z.array(z.object({ index: z.number().int(), name: z.string(), quality: z.number().int(), neighbours: z.array(z.number().int()), collapse: z.array(z.number().int()) }).strict()).min(5),
    attackRewards: z.array(z.object({ count: z.number().int(), score: z.number(), rewards }).strict()),
    bossRank: z.array(rank),
    guildRank: z.array(rank),
    scoreRewards: z.array(z.object({ rank: z.number().int(), score: z.number(), rewards }).strict()),
    personalRank: z.array(rank),
    cpuTopScore: z.number(),
  })
  .strict();
export type ParkJson = z.infer<typeof parkSchema>;
