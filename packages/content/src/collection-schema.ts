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
  })
  .strict();

export type CollectionJson = z.infer<typeof collectionTuningSchema>;
