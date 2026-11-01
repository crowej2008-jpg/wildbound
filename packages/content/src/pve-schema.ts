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
    /** R9: the climbs reset daily (source); the achievements come from tuning/tower.json. */
    climbsPerDay: z.number().int().positive(),
    sweepsPerDay: z.number().int().nonnegative(),
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

/** R9: the source's World Boss (scripts/import-world-boss.mjs); the boss's enemy stats stay a stand-in. */
export const worldBossSchema = z
  .object({
    fightsPerWindow: z.number().int().positive(),
    /** UTC hours each window is open (start inclusive, end exclusive). */
    windows: z.array(z.object({ startHour: z.number().int().min(0).max(23), endHour: z.number().int().min(1).max(24) }).strict()).min(1),
    ghostCount: z.number().int().nonnegative(),
    historyCap: z.number().int().positive(),
    milestones: z
      .array(z.object({ damage: z.number().positive(), rewards: rewardSchema }).strict())
      .min(1),
    /** Paid by mail when a window closes: the first row whose `upToRank` covers the rank. */
    rankRewards: z.array(z.object({ upToRank: z.number().int().positive(), rewards: rewardSchema }).strict()).min(1),
    /** Owner (2026-11-01): every fight drops 5-Star Pokémon Shards (the source's drop bag is not in the dumps). */
    dropPerFight: rewardSchema,
    /** Source fight_basic dtype 12: skipping the boss fight needs this VIP level. */
    skipVip: z.number().int().min(0),
    /** Owner (2026-11-01): a really strong boss that cannot die — multipliers on its sheet. */
    boss: z.object({ hpMult: z.number().positive(), atkMult: z.number().positive(), defMult: z.number().positive() }).strict(),
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

