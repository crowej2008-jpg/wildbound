import { z } from 'zod';
import { rewardSchema } from './schemas';

/**
 * Pet Home tuning (M13.1). The source is a merge board: summon a ball, open it,
 * merge two equal-level Wilds, and let the board earn Home Coins. R9: the
 * numbers come from the source (scripts/import-pet-home.mjs); names and the board layout are ours.
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
    /** Rare Orb Chests in the level reward (R9, source item 13001); each rolls one orb. */
    orbChests: z.number().int().positive().optional(),
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
    /** Price as a percent of full (source `discount`; 90 = 10 % off). Display only. */
    discount: z.number().int().min(1).max(100).optional(),
    grants: rewardSchema,
    /** R9: the source rows each sell one orb at a fixed level. */
    orb: z
      .object({
        kind: z.string().min(1),
        colour: z.enum(['green', 'blue', 'purple', 'orange', 'red']),
        level: z.number().int().min(1).max(10),
      })
      .strict()
      .optional(),
  })
  .strict();

export const petHomeShopBandSchema = z
  .object({
    /** Home levels this band is drawn at (source `home_lev`); bands may overlap and are pooled. */
    minLevel: z.number().int().min(0).max(16),
    maxLevel: z.number().int().min(0).max(16),
    offers: z.array(petHomeShopOfferSchema).min(1),
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
        /** Rare Orb Chest: one orb of a uniform kind at this level; colour by weight. */
        orbChest: z
          .object({
            level: z.number().int().min(1).max(10),
            weights: z.record(z.enum(['green', 'blue', 'purple', 'orange', 'red']), z.number().nonnegative()),
          })
          .strict(),
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
