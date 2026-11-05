import { z } from 'zod';
import { enemyPoolSchema } from './pve-schema';

/** Misty Woods tuning (M13.6), from the source's maze tables via scripts/import-misty.mjs. */
const tile = z.enum(['fight', 'boss', 'start', 'tombstone', 'fountain', 'hire', 'shop']);

export const mistySchema = z
  .object({
    cycleDays: z.number().int().positive(),
    chapter4Stage: z.string().min(1),
    nodes: z
      .array(
        z
          .object({
            id: z.number().int().positive(),
            chapter: z.number().int().min(1).max(4),
            floor: z.number().int().min(1).max(11),
            pos: z.number().int().positive(),
            tiles: z.array(tile).min(1),
            pre: z.array(z.number().int().nonnegative()).min(1),
          })
          .strict(),
      )
      .min(1),
    floors: z
      .array(
        z
          .object({
            chapter: z.number().int().min(1).max(4),
            floor: z.number().int().min(1).max(11),
            rate: z.number().positive(),
            forestCoin: z.number().int().nonnegative(),
            gems: z.number().int().nonnegative(),
          })
          .strict(),
      )
      .min(1),
    fountainHeal: z.number().min(0).max(1),
    reviveHp: z.number().min(0).max(1),
    shop: z.object({ healAll: z.number().int().nonnegative(), revive: z.number().int().nonnegative() }).strict(),
    hireOffers: z.number().int().positive(),
    enemy: enemyPoolSchema,
  })
  .strict();

export type MistyJson = z.infer<typeof mistySchema>;
