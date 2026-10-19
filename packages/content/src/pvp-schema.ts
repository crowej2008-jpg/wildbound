import { z } from 'zod';
import { factionSchema, rewardSchema } from './schemas';
import { enemyPoolSchema } from './pve-schema';

/**
 * PvP content schemas (M10, PROMPT §7.7). One table drives the Arena (credits,
 * band rewards, participation chests, best-rank achievements) and the Ranked
 * ladder (phases, tiers, gift track, attempts). See docs/design/pvp.md.
 *
 * Region and tier *names* are the franchise's, kept per the owner content
 * override (docs/ASSUMPTIONS.md › Owner content override, item 10). They are
 * display strings; no code branches on them.
 */

export const arenaBandSchema = z
  .object({
    /** Lowest credits inside this band. Bands are sorted ascending. */
    minCredits: z.number().int().nonnegative(),
    /** Arena place this band's floor represents ("My Ranking"). */
    startPlace: z.number().int().positive(),
    /** Paid at the weekly settlement. */
    reward: rewardSchema,
    /** Credits after the weekly reset for a player who settled in this band. */
    resetCredits: z.number().int().nonnegative(),
  })
  .strict();

export const arenaChestSchema = z
  .object({ battles: z.number().int().positive(), reward: rewardSchema })
  .strict();

export const arenaAchievementSchema = z
  .object({ place: z.number().int().positive(), reward: rewardSchema })
  .strict();

export const arenaSchema = z
  .object({
    freeAttemptsPerDay: z.number().int().positive(),
    /** Gems per bought attempt, by the day's purchase number (last repeats). */
    attemptPrices: z.array(z.number().int().nonnegative()).min(1),
    opponentCount: z.number().int().positive(),
    creditsPerWin: z.number().int().positive(),
    creditsPerLoss: z.number().int().positive(),
    creditCap: z.number().int().positive(),
    bands: z.array(arenaBandSchema).min(2),
    /** Daily participation chests for the first N battles. */
    chestTiers: z.array(arenaChestSchema).min(1),
    /** One-time rewards by the player's best-ever place. */
    bestRankTiers: z.array(arenaAchievementSchema),
    opponent: enemyPoolSchema,
  })
  .strict();

export const rankedTierSchema = z
  .object({ name: z.string().min(1), score: z.number().int().nonnegative() })
  .strict();

export const rankedGiftSchema = z
  .object({ matches: z.number().int().positive(), reward: rewardSchema })
  .strict();

export const rankedPhaseSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    /** Team format: `teams` squads of `teamSize` (the reference's 2×4 … 3×6). */
    teams: z.number().int().positive(),
    teamSize: z.number().int().positive(),
    /** Tier rewards in PvP tokens, one per `tiers` row (ascending). */
    coins: z.array(z.number().int().nonnegative()).min(1),
    /** Factions this phase may roll as weather. */
    weather: z.array(factionSchema).min(1),
  })
  .strict();

export const rankedSchema = z
  .object({
    freeAttemptsPerDay: z.number().int().positive(),
    attemptPrices: z.array(z.number().int().nonnegative()).min(1),
    winScore: z.number().int().positive(),
    lossScore: z.number().int().positive(),
    bestOf: z.number().int().positive(),
    /** Weather damage bonus (the reference's +30%). */
    weatherDmg: z.number().min(0),
    /** Tiers shared by every phase (the reference's Vanguard I … King). */
    tiers: z.array(rankedTierSchema).length(12),
    /** Challenge-count gift track (matches → reward). */
    giftTrack: z.array(rankedGiftSchema).min(1),
    phases: z.array(rankedPhaseSchema).min(1),
    /** The ghost rival curve; `count` is trimmed to the phase's `teamSize`. */
    opponent: enemyPoolSchema,
  })
  .strict();

export const pvpSchema = z
  .object({
    /** Campaign chapter that opens the Arena (the reference's Main Story 5-2). */
    arenaChapter: z.number().int().positive(),
    /** Campaign chapter that opens Ranked (the reference's 6th gym). */
    rankedChapter: z.number().int().positive(),
    arena: arenaSchema,
    ranked: rankedSchema,
  })
  .strict()
  .superRefine((v, ctx) => {
    const rows = v.ranked.tiers.length;
    v.ranked.phases.forEach((phase, i) => {
      if (phase.coins.length !== rows) {
        ctx.addIssue({
          code: 'custom',
          path: ['ranked', 'phases', i, 'coins'],
          message: `phase "${phase.id}" has ${phase.coins.length} coin rows, expected ${rows}`,
        });
      }
    });
  });

export type PvpJson = z.infer<typeof pvpSchema>;
export type ArenaJson = z.infer<typeof arenaSchema>;
export type ArenaBandJson = z.infer<typeof arenaBandSchema>;
export type RankedJson = z.infer<typeof rankedSchema>;
export type RankedPhaseJson = z.infer<typeof rankedPhaseSchema>;
export type RankedTierJson = z.infer<typeof rankedTierSchema>;
