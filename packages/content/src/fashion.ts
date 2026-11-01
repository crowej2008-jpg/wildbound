import { z } from 'zod';
import raw from '../tuning/fashion.json';

/**
 * R8: Mount, Back Decor, Follower and Outfits (scripts/import-fashion.mjs). The pieces and the 35 sets are the
 * source's; the shared level curve and the piece stats are made up (owner, 2026-11-01).
 */
export const FASHION_SLOTS = ['outfit', 'follower', 'mount', 'backDecor'] as const;
export type FashionSlot = (typeof FASHION_SLOTS)[number];
/** The three slots with a level ladder (each fed by its own stone). */
export const FASHION_LADDERS = ['mount', 'backDecor', 'follower'] as const;
export type FashionLadder = (typeof FASHION_LADDERS)[number];

const slot = z.enum(FASHION_SLOTS);
export const fashionSchema = z.object({
  _note: z.string().optional(),
  maxStar: z.number().int().min(1),
  ladder: z
    .array(
      z.object({
        level: z.number().int().min(0),
        tier: z.number().int().min(1),
        star: z.number().int().min(0),
        exp: z.number().int().min(0),
        hp: z.number().int().min(0),
        atk: z.number().int().min(0),
        pct: z.number().min(0),
      }),
    )
    .length(201),
  pieces: z.array(
    z.object({
      slot,
      index: z.number().int().min(1),
      name: z.string().min(1),
      free: z.boolean(),
      shape: z
        .object({
          pct: z.number().min(0),
          pctStep: z.number().min(0),
          hp: z.number().min(0),
          hpStep: z.number().min(0),
          atk: z.number().min(0),
          atkStep: z.number().min(0),
          pctStat: z.enum(['hpPct', 'atkPct']),
        })
        .nullable(),
    }),
  ),
  sets: z
    .array(
      z.object({
        id: z.number().int(),
        name: z.string().min(1),
        pieces: z.array(z.object({ slot, index: z.number().int() })).length(4),
        title: z.string(),
        bonuses: z.array(
          z.object({
            pieces: z.number().int().min(2),
            lines: z.array(z.object({ field: z.string().min(1), value: z.number() })).min(1),
          }),
        ),
      }),
    )
    .length(35),
});

export const FASHION = fashionSchema.parse(raw);
export type FashionJson = z.infer<typeof fashionSchema>;
export type FashionPieceJson = FashionJson['pieces'][number];
