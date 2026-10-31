import { z } from 'zod';
import { enemyPoolSchema } from './pve-schema';
import { rewardSchema } from './schemas';

/**
 * Sky Pillar tuning (M13.2). 180 floors x 10 stages, two extra star conditions
 * per stage, three floor chests, and Proof of Sky recharge. Counts and shapes
 * follow the source; every number, reward and name is ours. See
 * docs/design/sky-pillar.md.
 */

export const skyPillarConditionSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('knockoutsAtMost'), value: z.number().int().min(0).max(6) }).strict(),
  z.object({ kind: z.literal('hpAtLeast'), value: z.number().int().min(1).max(100) }).strict(),
  z.object({ kind: z.literal('roundsAtMost'), value: z.number().int().min(1).max(30) }).strict(),
]);

export const skyPillarStageSchema = z
  .object({
    stage: z.number().int().min(1).max(10),
    pass: rewardSchema,
    sweep: rewardSchema,
    /** After the automatic clear star; exactly two conditions. */
    conditions: z.array(skyPillarConditionSchema).length(2),
  })
  .strict();

export const skyPillarChestSchema = z
  .object({
    stars: z.number().int().min(1).max(30),
    rewards: rewardSchema,
  })
  .strict();

export const skyPillarFloorSchema = z
  .object({
    floor: z.number().int().min(1).max(180),
    wing: z.number().int().min(1).max(6),
    playerLevel: z.number().int().min(1).max(80),
    enemy: enemyPoolSchema,
    stages: z.array(skyPillarStageSchema).length(10),
    chests: z.array(skyPillarChestSchema).length(3),
  })
  .strict();

export const skyPillarSchema = z
  .object({
    maxProofs: z.number().int().positive(),
    /** One Proof of Sky every N minutes while below the cap. */
    regenMinutes: z.number().int().positive(),
    initialProofs: z.number().int().nonnegative(),
    /** A battle that runs this many big rounds is a loss. */
    roundLimit: z.number().int().positive(),
    wings: z
      .array(z.object({ wing: z.number().int().min(1).max(6), name: z.string().min(1) }).strict())
      .length(6),
    floors: z.array(skyPillarFloorSchema).length(180),
  })
  .strict();

export type SkyPillarConditionJson = z.infer<typeof skyPillarConditionSchema>;
export type SkyPillarStageJson = z.infer<typeof skyPillarStageSchema>;
export type SkyPillarChestJson = z.infer<typeof skyPillarChestSchema>;
export type SkyPillarFloorJson = z.infer<typeof skyPillarFloorSchema>;
export type SkyPillarJson = z.infer<typeof skyPillarSchema>;
