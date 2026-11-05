import { z } from 'zod';
import { enemyPoolSchema } from './pve-schema';
import { factionSchema, rewardSchema } from './schemas';

/** Faction Tower tuning (M13.7), written by scripts/import-faction-tower.mjs. */
const tower = z.enum(['water', 'fire', 'grass']);
const weekday = z.number().int().min(0).max(6);
const stepped = z
  .object({ base: z.number().int().nonnegative(), step: z.number().int().nonnegative(), every: z.number().int().positive(), max: z.number().int().nonnegative() })
  .strict();

export const factionTowerSchema = z
  .object({
    _note: z.string().optional(),
    floors: z.number().int().positive(),
    floorsPerDay: z.number().int().positive(),
    twoTeamFrom: z.number().int().positive(),
    minOfType: z.number().int().min(0).max(6),
    allies: z.array(factionSchema),
    openDays: z.object({ water: z.array(weekday).min(1), fire: z.array(weekday).min(1), grass: z.array(weekday).min(1) }).strict(),
    freeSweeps: z.number().int().nonnegative(),
    sweepPrices: z.array(z.number().int().nonnegative()),
    pay: z.object({ gold: stepped, starShard: stepped, factionCoin: stepped }).strict(),
    bonus: z
      .object({ every: z.number().int().positive(), atFloor: z.number().int().positive(), factionCoin: z.number().int().nonnegative(), starShard: z.number().int().nonnegative() })
      .strict(),
    milestones: z
      .array(z.object({ faction: tower, floor: z.number().int().positive(), rewards: rewardSchema, evolveBox: z.number().int().nonnegative() }).strict())
      .min(1),
    evolveBoxes: z
      .object({
        water: z.array(z.object({ species: z.string().min(1), star: z.number().int().positive(), weight: z.number().positive() }).strict()).min(1),
        fire: z.array(z.object({ species: z.string().min(1), star: z.number().int().positive(), weight: z.number().positive() }).strict()).min(1),
        grass: z.array(z.object({ species: z.string().min(1), star: z.number().int().positive(), weight: z.number().positive() }).strict()).min(1),
      })
      .strict(),
    enemy: enemyPoolSchema,
  })
  .strict();

export type FactionTowerJson = z.infer<typeof factionTowerSchema>;
