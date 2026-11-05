import { z } from 'zod';
import { rewardSchema } from './schemas';

/** King's Trial tuning (M14.2), written by scripts/import-kings-trial.mjs. */
const pay = { rewards: rewardSchema, titleCard: z.string().optional(), notCopied: z.array(z.string()).optional() };

export const kingsTrialSchema = z
  .object({
    _note: z.string().optional(),
    areas: z.array(z.object({ id: z.number().int(), name: z.string() }).strict()).min(1),
    trainers: z
      .array(
        z
          .object({
            index: z.number().int().positive(),
            area: z.number().int(),
            name: z.string(),
            champion: z.boolean(),
            points: z.number().int().positive(),
            gyms: z.array(z.number().int().positive()),
            trainers: z.array(z.number().int().positive()),
            chests: z.array(z.object({ progress: z.number().int().positive(), ...pay }).strict()),
            firstClear: z.object(pay).strict(),
            perk: z
              .object({
                field: z.enum(['hpPct', 'pAtkPct', 'sAtkPct']),
                className: z.enum(['striker', 'guardian', 'adept']).optional(),
                faction: z.enum(['water', 'fire', 'grass', 'light', 'dark']).optional(),
                value: z.number().positive(),
              })
              .strict()
              .nullable(),
            perkText: z.string(),
          })
          .strict(),
      )
      .length(36),
    achTasks: z.array(z.object({ index: z.number().int(), event: z.string(), value: z.number(), points: z.number().int(), desc: z.string() }).strict()).min(1),
    achRewards: z.array(z.object({ index: z.number().int(), points: z.number().int(), ...pay }).strict()),
    weekly: z.array(z.object({ id: z.number().int(), event: z.string(), value: z.number(), points: z.number().int(), desc: z.string(), ...pay }).strict()),
  })
  .strict();

export type KingsTrialJson = z.infer<typeof kingsTrialSchema>;
