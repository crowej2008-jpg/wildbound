import { z } from 'zod';
import { rewardSchema } from './schemas';

/**
 * Pet Home tuning (M13.1). The source is a merge board: summon a ball, open it,
 * merge two equal-level Wilds, and let the board earn Home Coins. Counts and
 * shapes follow the source; every name, number and description here is ours.
 * See docs/design/pet-home.md.
 */

export const petHomeLevelSchema = z
  .object({
    level: z.number().int().min(0).max(16),
    /** Lifetime Home XP needed to reach this level; level 0 is 0. */
    xp: z.number().int().nonnegative(),
    /** Active + padlocked positions at this level (source: 6 -> 21). */
    tiles: z.number().int().min(6).max(21),
    /** Highest merge level allowed at this Home level (source: 8 -> 16). */
    mergeCap: z.number().int().min(1).max(16),
    /** Gems charged for a padlock opened while at this Home level. */
    unlockGems: z.number().int().nonnegative(),
    /** One-time reward for reaching this level; level 0 is empty. */
    reward: rewardSchema,
  })
  .strict();

export const petHomeTileSchema = z
  .object({
    id: z.number().int().nonnegative(),
    row: z.number().int().min(0).max(4),
    col: z.number().int().min(0).max(4),
    /** Home level that reveals this position. */
    unlockLevel: z.number().int().min(0).max(16),
    /** A revealed padlock must be bought; an open tile is free once revealed. */
    locked: z.boolean(),
  })
  .strict();

export const petHomeIncomeSchema = z
  .object({
    level: z.number().int().min(1).max(16),
    coinsPerFiveSeconds: z.number().int().positive(),
  })
  .strict();

export const petHomeShopOfferSchema = z
  .object({
    id: z.string().min(1),
    name: z.string().min(1),
    description: z.string().min(1),
    price: z.number().int().positive(),
    grants: rewardSchema,
  })
  .strict();

export const petHomeShopBandSchema = z
  .object({
    /** Selected when the Home level is at least this value. */
    minLevel: z.number().int().min(0).max(16),
    offers: z.array(petHomeShopOfferSchema).min(9),
  })
  .strict();

export const petHomeShopSchema = z
  .object({
    id: z.enum(['home', 'deluxe']),
    name: z.string().min(1),
    currency: z.enum(['homeCoin', 'orbEssence']),
    /** The Home level that reveals the shop. */
    unlockLevel: z.number().int().min(0).max(16),
    offersPerPage: z.number().int().positive(),
    refresh: z
      .object({
        maxPerDay: z.number().int().nonnegative(),
        costs: z
          .array(
            z.object({ afterRefreshes: z.number().int().nonnegative(), gems: z.number().int().nonnegative() }).strict(),
          )
          .min(1),
      })
      .strict(),
    bands: z.array(petHomeShopBandSchema).min(1),
  })
  .strict();

export const petHomeSchema = z
  .object({
    albumNote: z.string().min(1),
    home: z
      .object({
        offlineHours: z.number().positive(),
        /** Passive Home Coin settlement window. */
        tickSeconds: z.number().int().positive(),
        freeSummonsPerDay: z.number().int().nonnegative(),
        /** Paid summons after the free ones; the last matching bracket wins. */
        summonCosts: z
          .array(z.object({ afterPaid: z.number().int().nonnegative(), gems: z.number().int().nonnegative() }).strict())
          .min(1),
      })
      .strict(),
    levels: z.array(petHomeLevelSchema).length(17),
    tiles: z.array(petHomeTileSchema).length(21),
    income: z.array(petHomeIncomeSchema).length(16),
    shops: z.object({ home: petHomeShopSchema, deluxe: petHomeShopSchema }).strict(),
  })
  .strict();

export type PetHomeLevelJson = z.infer<typeof petHomeLevelSchema>;
export type PetHomeTileJson = z.infer<typeof petHomeTileSchema>;
export type PetHomeIncomeJson = z.infer<typeof petHomeIncomeSchema>;
export type PetHomeShopOfferJson = z.infer<typeof petHomeShopOfferSchema>;
export type PetHomeShopBandJson = z.infer<typeof petHomeShopBandSchema>;
export type PetHomeShopJson = z.infer<typeof petHomeShopSchema>;
export type PetHomeJson = z.infer<typeof petHomeSchema>;
