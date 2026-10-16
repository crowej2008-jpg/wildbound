import { z } from 'zod';
import { rewardSchema, tierSchema } from './schemas';

export const gachaTierWeightSchema = z
  .object({ tier: tierSchema, weight: z.number().positive() })
  .strict();

export const gachaMachineSchema = z
  .object({
    id: z.enum(['common', 'premium']),
    ticket: z.enum(['ticketCommon', 'ticketPremium']),
    gemPerDraw: z.number().nonnegative().nullable(),
    gemPerTen: z.number().nonnegative().nullable(),
    freePerDay: z.number().int().nonnegative(),
    freeCooldownMinutes: z.number().int().positive(),
    creditPerDraw: z.number().int().nonnegative(),
    boxCreditsNeeded: z.number().int().positive(),
    boxRewards: rewardSchema,
    pityThreshold: z.number().int().nonnegative(),
    wish: z.boolean(),
    wishBoost: z.number().positive(),
    wishUnlockDraws: z.number().int().nonnegative(),
    tenDrawGuarantee: tierSchema,
    rates: z.array(gachaTierWeightSchema).min(1),
  })
  .strict();

export const gachaSchema = z
  .object({ machines: z.array(gachaMachineSchema).length(2) })
  .strict();

export type GachaJson = z.infer<typeof gachaSchema>;

