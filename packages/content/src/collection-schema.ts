import { z } from 'zod';

/**
 * M11 collection tuning. Every cost the five deepened layers and the four new
 * systems charge lives here so balance passes never touch engine or server code.
 * See docs/design/collection.md.
 */
export const collectionTuningSchema = z
  .object({
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
