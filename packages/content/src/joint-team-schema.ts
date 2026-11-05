import { z } from 'zod';
import { rewardSchema } from './schemas';

/** Joint Team tuning (M14.4), written by scripts/import-joint-team.mjs. */
const prize = { rewards: rewardSchema, notCopied: z.array(z.string()).optional() };
const num = z.number().nonnegative();

export const jointTeamSchema = z
  .object({
    _note: z.string().optional(),
    battles: z
      .object({
        freePerDay: z.number().int().positive(),
        freeRefreshes: z.number().int().nonnegative(),
        winPoints: num,
        winBonus: num,
        lossPoints: num,
        perBattle: rewardSchema,
        personal: z.array(z.object({ battles: z.number().int().positive(), ...prize }).strict()),
        squad: z.array(z.object({ points: z.number().int().positive(), ...prize }).strict()),
        ranks: z.array(z.object({ upTo: z.number().int().positive(), rewards: rewardSchema }).strict()),
        shop: z.array(z.object({ id: z.number().int(), tier: z.number().int().nonnegative(), price: num, limit: z.number().int().positive(), ...prize }).strict()),
        skills: z.array(z.object({ field: z.string().min(1), perLevel: num, maxLevel: z.number().int().positive() }).strict()),
        skillCost: z.object({ base: num, perLevel: num }).strict(),
      })
      .strict(),
    wild: z
      .object({
        openDays: z.array(z.number().int()).length(2),
        openHours: z.array(z.number().int()).length(2),
        energyMax: z.number().int().positive(),
        energyRegenSec: z.number().int().positive(),
        canisterEnergy: z.number().int().positive(),
        teleporters: z.array(z.number().int().positive()),
        bosses: z.array(z.object({ zone: z.number().int(), species: z.string().min(1), wins: z.number().int().positive(), guaranteeBy: z.number().int().positive() }).strict()),
        badgesOnInner: z.number().int().nonnegative(),
        zones: z.array(
          z
            .object({
              zone: z.number().int().positive(),
              name: z.string().min(1),
              cost: z.number().int().positive(),
              events: z.array(z.object({ kind: z.enum(['normal', 'dynamax', 'ultra', 'chest', 'duel', 'guess']), weight: num, points: num }).strict()),
            })
            .strict(),
        ),
        multipliers: z.array(z.object({ rate: z.number().int().positive(), unlockEnergy: num }).strict()),
        fragments: z.array(z.object({ id: z.number().int(), name: z.string().min(1), hp: num, pAtk: num, sAtk: num }).strict()),
        drops: z.record(z.string(), z.array(z.record(z.string(), z.number()))),
        personalRanks: z.array(z.object({ upTo: z.number().int().positive(), ...prize }).strict()),
        squadRanks: z.array(z.object({ upTo: z.number().int().positive(), ...prize }).strict()),
        guessChance: z.object({ poke: num, advanced: num, master: num }).strict(),
      })
      .strict(),
  })
  .strict();

export type JointTeamJson = z.infer<typeof jointTeamSchema>;
