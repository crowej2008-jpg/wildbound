import { z } from 'zod';
import { rewardSchema } from './schemas';

/** Pokémon Paradise tuning (M14.3), written by scripts/import-paradise.mjs. */
const tower = z.enum(['water', 'fire', 'grass']);
const prize = { rewards: rewardSchema, evolveBoxes: z.array(tower).optional(), notCopied: z.array(z.string()).optional() };
const boxRow = z.object({ species: z.string().min(1), star: z.number().int().positive(), weight: z.number().positive() }).strict();

export const paradiseSchema = z
  .object({
    _note: z.string().optional(),
    seasonDays: z.number().int().positive(),
    baseStamina: z.number().int().positive(),
    baseTrack: z.number().min(0).max(1),
    exploreExp: z.number().int().nonnegative(),
    repeatCatchPoints: z.number().int().nonnegative(),
    advancedBallBoost: z.number().nonnegative(),
    gear: z
      .array(
        z
          .object({
            type: z.number().int().positive(),
            name: z.string().min(1),
            levels: z
              .array(
                z
                  .object({
                    level: z.number().int().positive(),
                    exp: z.number().int().nonnegative(),
                    maxStamina: z.number().int().positive().optional(),
                    freeExplore: z.number().min(0).max(1).optional(),
                    track: z.number().min(0).max(1).optional(),
                    findNew: z.number().min(0).max(1).optional(),
                    ballBoost: z.number().nonnegative().optional(),
                    freeBall: z.number().min(0).max(1).optional(),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .length(3),
    seasons: z
      .array(
        z
          .object({
            season: z.number().int().positive(),
            scenes: z.array(z.object({ scene: z.number().int().positive(), name: z.string().min(1), gearLevel: z.number().int().nonnegative() }).strict()).min(1),
            dex: z
              .array(
                z
                  .object({
                    id: z.number().int().positive(),
                    species: z.string().min(1),
                    star: z.number().int().positive(),
                    catchRate: z.number().min(0).max(1),
                    stars: z.array(z.number().int().nonnegative()).length(4),
                    points: z.array(z.number().int().nonnegative()).length(4),
                    stepWeights: z.array(z.number().nonnegative()).length(4),
                    pool: z.number().int().positive(),
                    poolWeight: z.number().positive(),
                    scene: z.number().int().positive(),
                    fleeShards: z.record(z.string(), z.number().int().positive()),
                  })
                  .strict(),
              )
              .min(1),
            starRewards: z.array(z.object({ stars: z.number().int().positive(), ...prize }).strict()),
            categoryRewards: z.array(z.object({ step: z.number().int().positive(), ...prize }).strict()),
            shop: z
              .array(
                z
                  .object({
                    id: z.number().int().positive(),
                    ...prize,
                    points: z.number().int().positive().optional(),
                    exp: z.number().int().positive().optional(),
                    limit: z.number().int().positive(),
                    gearLevel: z.number().int().nonnegative(),
                  })
                  .strict(),
              )
              .min(1),
          })
          .strict(),
      )
      .min(1),
    evolveBoxes: z.object({ water: z.array(boxRow), fire: z.array(boxRow), grass: z.array(boxRow) }).strict(),
  })
  .strict();

export type ParadiseJson = z.infer<typeof paradiseSchema>;
