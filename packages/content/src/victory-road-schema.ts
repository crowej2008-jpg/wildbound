import { z } from 'zod';
import { rewardSchema } from './schemas';

/** Victory Road tuning (M14.1), written by scripts/import-victory-road.mjs. */
const pay = { rewards: rewardSchema, titleCard: z.string().optional(), notCopied: z.array(z.string()).optional() };
const perk = z
  .object({
    kind: z.enum(['afk', 'stat', 'arenaTokens', 'rankedTokens', 'mistyCoins', 'factionCoins', 'skyPillarChallenge', 'skyPillarSweep', 'ladderCoins', 'shop']),
    value: z.number(),
    field: z.enum(['hpPct', 'pAtkPct', 'sAtkPct']).optional(),
    className: z.enum(['striker', 'guardian', 'adept']).optional(),
    faction: z.enum(['water', 'fire', 'grass', 'light', 'dark']).optional(),
  })
  .strict();
const task = z
  .object({
    kind: z.enum(['trainerLevel', 'story', 'tower', 'gym', 'pokemonLevel', 'pokemonStars', 'plates', 'trinkets', 'berries', 'orbs', 'factionTower', 'misty', 'untracked']),
    desc: z.string(),
    value: z.number().optional(),
    stage: z.string().optional(),
    floor: z.number().optional(),
    gym: z.number().optional(),
    level: z.number().optional(),
    stars: z.number().optional(),
    plateStage: z.number().optional(),
    star: z.number().optional(),
    count: z.number().optional(),
    ...pay,
  })
  .strict();

export const victoryRoadSchema = z
  .object({
    _note: z.string().optional(),
    areas: z.array(z.object({ id: z.number().int(), name: z.string() }).strict()).min(1),
    gyms: z
      .array(
        z
          .object({
            index: z.number().int().positive(),
            area: z.number().int(),
            badge: z.string(),
            text: z.string(),
            dailyGems: z.number().int().nonnegative(),
            perk: perk.nullable(),
            chests: z.array(z.object({ progress: z.number().int().positive(), ...pay }).strict()).min(1),
            task: task.nullable(),
          })
          .strict(),
      )
      .length(60),
  })
  .strict();

export type VictoryRoadJson = z.infer<typeof victoryRoadSchema>;
