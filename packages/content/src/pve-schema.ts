import { z } from 'zod';
import { factionSchema, rewardSchema, tierSchema } from './schemas';

/**
 * PvE-mode content schemas (M8, PROMPT §7.6). One table drives Tower, Trials,
 * World Boss, Daily Dungeons and the Link Crystal. See docs/design/pve-modes.md.
 */

export const enemyPoolSchema = z
  .object({
    factions: z.array(factionSchema),
    tiers: z.array(tierSchema),
    count: z.number().int().positive(),
    baseLevel: z.number().positive(),
    levelSlope: z.number().positive(),
    starsEvery: z.number().int().nonnegative(),
    maxStars: z.number().int().positive(),
    stageEvery: z.number().int().nonnegative(),
    maxStage: z.number().int().nonnegative(),
  })
  .strict();

export const towerSchema = z
  .object({
    climbsPerWeek: z.number().int().positive(),
    sweepsPerDay: z.number().int().nonnegative(),
    milestoneEvery: z.number().int().positive(),
    milestoneCap: z.number().int().positive(),
    milestoneRewards: rewardSchema,
    reward: z
      .object({
        goldBase: z.number().nonnegative(),
        goldPerFloor: z.number().nonnegative(),
        shardBase: z.number().nonnegative(),
        shardPerFloor: z.number().nonnegative(),
        coinBase: z.number().nonnegative(),
        coinPerFloor: z.number().nonnegative(),
        capFloor: z.number().int().positive(),
      })
      .strict(),
    enemy: enemyPoolSchema,
  })
  .strict();

export const trialRuleSchema = z.enum([
  'factionLocked',
  'noUltimate',
  'levelCapped',
  'survival',
  'weekdayBoss',
]);

export const trialSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    tagline: z.string().min(1),
    rule: trialRuleSchema,
    faction: factionSchema.optional(),
    maxLevel: z.number().int().positive().optional(),
    survivalRounds: z.number().int().positive().optional(),
    weekdays: z.array(z.number().int().min(0).max(6)).optional(),
    unlockLevel: z.number().int().nonnegative(),
    preview: rewardSchema,
    rewards: rewardSchema,
    enemy: enemyPoolSchema,
  })
  .strict();

/**
 * R9: stand-in enemies for the source's four daily dungeons (their monster bags are not in the dumps); the
 * difficulty's trainer level sets the enemy level.
 */
export const dungeonEnemiesSchema = z
  .object({ gold: enemyPoolSchema, vanity: enemyPoolSchema, xp: enemyPoolSchema, shard: enemyPoolSchema })
  .strict();

export const worldBossSchema = z
  .object({
    attemptsPerDay: z.number().int().positive(),
    ghostCount: z.number().int().nonnegative(),
    historyCap: z.number().int().positive(),
    milestones: z
      .array(z.object({ damage: z.number().positive(), rewards: rewardSchema }).strict())
      .min(1),
    enemy: enemyPoolSchema,
    rotation: z
      .array(
        z
          .object({ weekday: z.number().int().min(0).max(6), speciesId: z.string().min(1), name: z.string().min(1) })
          .strict(),
      )
      .min(1),
  })
  .strict();

export const pveSchema = z
  .object({
    tower: towerSchema,
    worldBoss: worldBossSchema,
    trials: z.array(trialSchema).min(1),
    dungeonEnemies: dungeonEnemiesSchema,
  })
  .strict();

export type PveJson = z.infer<typeof pveSchema>;
export type EnemyPoolJson = z.infer<typeof enemyPoolSchema>;
export type TrialDefJson = z.infer<typeof trialSchema>;

