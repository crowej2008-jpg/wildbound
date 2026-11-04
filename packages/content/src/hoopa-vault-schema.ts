import { z } from 'zod';
import { enemyPoolSchema } from './pve-schema';

/**
 * Hoopa's Vault tuning (M13.3). The floor bands are the source's `hupa_treasury_difficulty_json`
 * (scripts/import-hoopa-vault.mjs); the run rules follow the agreed plan and the owner's wiki; the pay numbers
 * are labelled stand-ins until the drop pools are known. See docs/design/hoopa-vault.md.
 */

const card = z
  .object({
    escape: z.number().int().positive(),
    enemyMult: z.number().positive(),
    attackBoost: z.number().min(0),
    dropBoost: z.number().min(0),
    weight: z.number().min(0),
  })
  .strict();

export const hoopaVaultSchema = z
  .object({
    floors: z.number().int().positive(),
    freeKeysPerDay: z.number().int().nonnegative(),
    multipliers: z.array(z.object({ afterFloor: z.number().int().nonnegative(), max: z.number().int().min(1) }).strict()).min(1),
    run: z
      .object({
        startEscape: z.number().int().positive(),
        target: z.number().int().positive(),
        offerSize: z.number().int().min(1),
        cards: z.object({ strong: card, normal: card, buff: card, blessing: card }).strict(),
      })
      .strict(),
    guardian: z
      .object({
        rounds: z.number().int().positive(),
        mult: z.object({ hp: z.number().positive(), atk: z.number().positive(), def: z.number().positive() }).strict(),
      })
      .strict(),
    enemy: enemyPoolSchema,
    stagePay: z
      .object({
        heldItemShard: z.object({ base: z.number().nonnegative(), perFloor: z.number().nonnegative() }).strict(),
        resetterShard: z
          .object({ chance: z.number().min(0).max(1), min: z.number().int().nonnegative(), max: z.number().int().nonnegative() })
          .strict(),
      })
      .strict(),
    guardianPay: z
      .object({
        resetterShard: z.object({ min: z.number().int().nonnegative(), max: z.number().int().nonnegative() }).strict(),
        heldItemShard: z.number().int().nonnegative(),
        items: z.number().int().nonnegative(),
      })
      .strict(),
    routeDrops: z.object({ itemChance: z.number().min(0).max(1), orbChance: z.number().min(0).max(1) }).strict(),
    resetterFactor: z.array(z.object({ floor: z.number().int().min(1), factor: z.number().positive() }).strict()).min(1),
    bands: z
      .array(
        z
          .object({
            floor: z.number().int().min(1),
            dropPool: z.number().int(),
            note: z.string().min(1),
            qualities: z.record(z.enum(['rare', 'epic', 'legendary', 'supreme', 'mythic']), z.number().min(0)),
            orb: z
              .object({ colour: z.enum(['purple', 'orange', 'red']), level: z.number().int().min(1).max(10) })
              .strict()
              .nullable(),
          })
          .strict(),
      )
      .min(1),
  })
  .strict();

export type HoopaVaultJson = z.infer<typeof hoopaVaultSchema>;
