import { z } from 'zod';

/**
 * M11 collection tuning. Every cost the five deepened layers and the four new
 * systems charge lives here so balance passes never touch engine or server code.
 * See docs/design/collection.md.
 */
export const collectionTuningSchema = z
  .object({
    potential: z.object({
      /** Duplicate Wilds consumed when a tier is first unlocked. */
      fodderPerTier: z.number().int().min(0),
      /** Potential Shards for tier 0. */
      shardBase: z.number().int().min(0),
      /** Extra shards for each tier after 0. */
      shardPerTier: z.number().int().min(0),
      /** Shards charged when re-picking an already unlocked tier. */
      respecShardFee: z.number().int().min(0),
      /** Gems charged by a full reset. */
      resetGems: z.number().int().min(0),
    }),
    orbs: z.object({
      /** Same kind/level duplicates consumed per level. */
      copiesPerLevel: z.number().int().min(0),
      /** Orb Essence for level 1 → 2. */
      essenceBase: z.number().int().min(0),
      /** Extra Orb Essence per level after the first. */
      essencePerLevel: z.number().int().min(0),
    }),
    soulhearts: z.object({
      /** Soul-heart EXP for the first star-up (2★ → 3★). */
      expBase: z.number().int().min(0),
      /** Extra EXP per current star. */
      expPerStar: z.number().int().min(0),
    }),
    berries: z.object({
      /** Duplicate copies consumed by each star-up. */
      upgradeCopies: z.number().int().min(1),
      /** Berry Essence for the first star-up. */
      upgradeEssenceBase: z.number().int().min(0),
      /** Extra Berry Essence per current star. */
      upgradeEssencePerStar: z.number().int().min(0),
      /** Essence paid by dismantling one spare copy, by tier. */
      dismantleEssence: z.object({
        common: z.number().int().min(0),
        basic: z.number().int().min(0),
        intermediate: z.number().int().min(0),
        greater: z.number().int().min(0),
      }),
    }),
    plates: z.object({
      /** Stages 0–20; stage 0 is the default. */
      maxStage: z.number().int().min(1),
      /** Plate Bottles for stage 0 → 1. */
      bottleBase: z.number().int().min(0),
      /** Extra Bottles per current stage. */
      bottlePerStage: z.number().int().min(0),
      /** Plate Fragments paid by the 5 → 6 step. */
      fragmentCost: z.number().int().min(0),
      /** The stage whose socket unlock is deferred. */
      skillSwapStage: z.number().int().min(1),
    }),
    trinkets: z.object({
      /** Levels 0–40; 0 is the default. */
      maxLevel: z.number().int().min(1),
      /** Star Shards for level 0 → 1. */
      shardBase: z.number().int().min(0),
      /** Extra Star Shards per current level. */
      shardPerLevel: z.number().int().min(0),
    }),
    resonance: z.object({
      /** Total slots on the account-wide resonance board. */
      slots: z.number().int().min(1),
      /** Slots open without spending Resonation Shards. */
      openSlots: z.number().int().min(1),
      /** Shards for the first locked slot. */
      unlockBase: z.number().int().min(0),
      /** Extra Shards for each later locked slot. */
      unlockPerSlot: z.number().int().min(0),
      /** Stats granted per Link Crystal level to a slotted Wild. */
      perLevel: z.object({
        hp: z.number().min(0),
        pAtk: z.number().min(0),
        sAtk: z.number().min(0),
        pDef: z.number().min(0),
        sDef: z.number().min(0),
        spd: z.number().min(0),
      }),
    }),
    vip: z.object({
      /** Activity tiers, ascending by lifetime XP; tier 0 starts at 0 XP. */
      tiers: z.array(
        z.object({
          tier: z.number().int().min(0),
          name: z.string().min(1),
          /** Lifetime trainer XP needed for this tier. */
          xp: z.number().int().min(0),
          /** Extra idle-accrual cap hours. */
          idleCapBonusHours: z.number().min(0),
          /** Fraction taken off shop item prices (0.04 = 4%). */
          shopDiscount: z.number().min(0).max(0.9),
          /** Common Tickets in the daily VIP supply. */
          dailyTickets: z.number().int().min(0),
        }),
      ).min(1),
    }),
  })
  .strict();

export type CollectionJson = z.infer<typeof collectionTuningSchema>;
