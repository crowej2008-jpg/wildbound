import { z } from 'zod';
import { enemyPoolSchema } from './pve-schema';
import { rewardSchema } from './schemas';

/** Berry Grove tuning (M13.8): the owner's replacement for the Island Challenge; every number a stand-in. */
const band = z.object({ upTo: z.number().int().positive(), rewards: rewardSchema }).strict();

export const berryGroveSchema = z
  .object({
    _note: z.string().optional(),
    plots: z.number().int().positive(),
    seeds: z
      .array(
        z
          .object({
            tier: z.enum(['common', 'basic', 'intermediate', 'greater']),
            currency: z.enum(['seedCommon', 'seedBasic', 'seedIntermediate', 'seedGreater']),
            growHours: z.number().positive(),
            essence: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .length(4),
    guardians: z
      .object({
        stages: z.number().int().positive(),
        climbsPerDay: z.number().int().positive(),
        bands: z.array(band).min(1),
        everyTen: rewardSchema,
        enemy: enemyPoolSchema,
      })
      .strict(),
    boss: z
      .object({
        fightsPerDay: z.number().int().positive(),
        hpMult: z.number().positive(),
        atkMult: z.number().positive(),
        defMult: z.number().positive(),
        minShare: z.number().min(0).max(1),
        rotation: z.array(z.string().min(1)).length(7),
        bands: z.array(band).min(1),
      })
      .strict(),
  })
  .strict();

export type BerryGroveJson = z.infer<typeof berryGroveSchema>;
