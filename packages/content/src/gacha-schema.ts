import { z } from 'zod';
import { factionSchema, rewardSchema, tierSchema } from './schemas';

/** R9: summoning copied from the source (scripts/import-gacha.mjs, docs/design/gacha.md). */

export const gachaRowSchema = z
  .object({
    species: z.string().min(1),
    star: z.number().int().positive(),
    /** The odds the source shows, in parts per million of one draw (fake_weight). */
    weight: z.number().int().positive(),
    group: z.enum(['other', 'epic', 'legendary', 'supreme', 'mythic']),
  })
  .strict();

export const gachaMachineSchema = z
  .object({
    id: z.enum(['common', 'premium']),
    ticket: z.enum(['ticketCommon', 'ticketPremium']),
    gemPerDraw: z.number().int().positive().nullable(),
    gemPerTen: z.number().int().positive().nullable(),
    freePerDay: z.number().int().nonnegative(),
    freeCooldownMinutes: z.number().int().positive(),
    creditPerDraw: z.number().int().nonnegative(),
    vipCreditPerDraw: z.number().int().nonnegative(),
    boxCreditsNeeded: z.number().int().positive(),
    boxRewards: rewardSchema,
    maxTenBatches: z.number().int().positive(),
    pool: z.array(gachaRowSchema).min(1),
  })
  .strict();

export const gachaSchema = z
  .object({
    _note: z.string().optional(),
    machines: z.array(gachaMachineSchema).length(2),
    wishingWell: z
      .object({
        machine: z.enum(['common', 'premium']),
        unlockDraws: z.number().int().nonnegative(),
        factions: z.array(factionSchema).min(1),
        tier: tierSchema,
        boost: z.number().positive(),
      })
      .strict(),
    supremeGift: z
      .object({
        credits: z.number().int().positive(),
        vipLevel: z.number().int().nonnegative(),
        species: z.array(z.string().min(1)).min(1),
      })
      .strict(),
  })
  .strict();

export type GachaJson = z.infer<typeof gachaSchema>;
