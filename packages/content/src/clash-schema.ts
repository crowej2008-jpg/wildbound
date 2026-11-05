import { z } from 'zod';

/** Cross-Server Clash tuning (M18.2), written by scripts/import-clash.mjs. */
const rewards = z.record(z.string(), z.number());
const round = z
  .object({
    step: z.number().int(),
    kind: z.enum(['score', 'knockout']),
    battle: z.tuple([z.number(), z.number()]),
    winScore: z.number(),
    lossScore: z.number(),
    rewards,
    bet: z.object({ min: z.number(), max: z.number(), right: z.number(), wrong: z.number() }).strict().nullable(),
    thirdPlace: z.boolean(),
  })
  .strict();
export const clashSchema = z
  .object({
    unlock: z.object({ serverDay: z.number().int(), stage: z.string(), level: z.number().int() }).strict(),
    arenaTop: z.number().int().positive(),
    tryoutDays: z.array(z.number().int()),
    finalDay: z.number().int(),
    days: z.record(z.string(), z.array(round).min(1)),
    lineups: z.array(z.object({ teams: z.number().int(), size: z.number().int(), from: z.number(), to: z.number() }).strict()),
    guessCoins: z.number(),
    championBonus: rewards,
    scoreCut: z.number(),
    cpu: z.object({ base: z.number(), perRound: z.number(), sunday: z.number() }).strict(),
  })
  .strict();
export type ClashJson = z.infer<typeof clashSchema>;
