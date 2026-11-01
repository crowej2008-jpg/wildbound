import { z } from 'zod';

/**
 * M11 collection tuning. Every cost the five deepened layers and the four new
 * systems charge lives here so balance passes never touch engine or server code.
 * See docs/design/collection.md.
 */
export const collectionTuningSchema = z
  .object({
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
