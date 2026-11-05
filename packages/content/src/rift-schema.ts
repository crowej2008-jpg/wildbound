import { z } from 'zod';
import { enemyPoolSchema } from './pve-schema';
import { rewardSchema } from './schemas';

/**
 * Rift Barriers tuning (M13.4), from the source's New Rift Arena via scripts/import-rift.mjs. Stand-ins are
 * listed in docs/design/rift-arena.md.
 */
const extras = {
  orbs: z
    .object({
      colour: z.enum(['green', 'blue', 'purple', 'orange', 'red']),
      level: z.number().int().min(1).max(10),
      count: z.number().int().positive(),
    })
    .strict()
    .optional(),
  mythicHeld: z.number().int().positive().optional(),
};

export const riftSchema = z
  .object({
    floors: z.number().int().positive(),
    easyFloors: z.number().int().positive(),
    livesPerDay: z.number().int().positive(),
    bossEvery: z.number().int().positive(),
    season: z
      .object({
        openDay: z.number().int().min(1).max(7),
        openHour: z.number().int().min(0).max(23),
        endDay: z.number().int().min(1).max(7),
        endHour: z.number().int().min(0).max(23),
      })
      .strict(),
    coinToGold: z.number().nonnegative(),
    difficulties: z
      .array(
        z
          .object({
            difficulty: z.number().int().min(1),
            minResonance: z.number().int().nonnegative(),
            syncLevel: z.number().int().positive(),
            floorRewards: z.array(z.object({ floor: z.number().int().positive(), rewards: rewardSchema }).strict()),
          })
          .strict(),
      )
      .min(1),
    drops: z.object({ easy: rewardSchema, easyBoss: rewardSchema, advanced: rewardSchema, advancedBoss: rewardSchema }).strict(),
    chests: z.array(z.object({ challenges: z.number().int().positive(), rewards: rewardSchema }).strict()),
    enemy: enemyPoolSchema,
    bossMult: z.number().positive(),
    milestones: z.array(z.object({ floor: z.number().int().positive(), rewards: rewardSchema, ...extras }).strict()),
    merchant: z.array(
      z
        .object({
          id: z.string().min(1),
          name: z.string().min(1),
          unlockFloor: z.number().int().nonnegative(),
          price: z.object({ currency: z.enum(['timeCoin', 'gems']), amount: z.number().int().positive() }).strict(),
          grants: rewardSchema,
          limit: z.number().int().positive(),
          ...extras,
        })
        .strict(),
    ),
    _leftOut: z.array(z.string()).optional(),
  })
  .strict();

export type RiftJson = z.infer<typeof riftSchema>;
