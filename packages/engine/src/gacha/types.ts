import type { Faction, Tier } from '../model';
import type { Rewards } from '../economy/rewards';

/**
 * Summoning (gacha) vocabulary — R9: copied from the source (docs/design/gacha.md,
 * ASSUMPTIONS #83). Pure types + tiny helpers; the roll rules live in `gacha.ts`, the data in
 * `content/tuning/gacha.json` (scripts/import-gacha.mjs).
 */

export type MachineId = 'common' | 'premium';

export const MACHINE_IDS: readonly MachineId[] = ['common', 'premium'];

/** The pool's display groups (the source's chest_reward group_name). */
export type GachaGroup = 'other' | 'epic' | 'legendary' | 'supreme' | 'mythic';

/** One pool row: a Pokémon at a star, with the source's weight (parts per million of a draw). */
export interface GachaRow {
  speciesId: string;
  star: number;
  weight: number;
  group: GachaGroup;
  /** The species' faction and tier (filled from the species list; the Wishing Well reads them). */
  faction: Faction;
  tier: Tier;
}

/** A machine's full tuning (chest_basic / chest_score / chest_reward). */
export interface GachaMachineDef {
  id: MachineId;
  /** Ticket currency id (a `CurrencyId`). */
  ticket: string;
  /** Gem price for a single / ten draw; null = no gem fallback. */
  gemPerDraw: number | null;
  gemPerTen: number | null;
  freePerDay: number;
  freeCooldownMinutes: number;
  /** Box credits a draw adds (chest_basic score). */
  creditPerDraw: number;
  /** VIP credits a draw adds toward the Supreme Gift (score_new). */
  vipCreditPerDraw: number;
  /** Credits one box costs; a claim spends them and repeats. */
  boxCreditsNeeded: number;
  boxRewards: Rewards;
  /** Ten-draw batches one press may buy with tickets (the Premium "plus" multi: up to 5). */
  maxTenBatches: number;
}

/** The Premium Wishing Well: a chosen faction's Legendaries come `boost` times as often. */
export interface WishingWellDef {
  machine: MachineId;
  unlockDraws: number;
  factions: readonly Faction[];
  tier: Tier;
  boost: number;
}

/** The VIP credit box: `credits` open one Pokémon from `species` at equal weight, from `vipLevel`. */
export interface SupremeGiftDef {
  credits: number;
  vipLevel: number;
  species: readonly string[];
}

/** One draw's outcome. */
export interface DrawResult {
  speciesId: string;
  star: number;
  tier: Tier;
  group: GachaGroup;
  /** The species was not in the roster before this batch of draws. */
  isNew: boolean;
}

/** Per-machine bookkeeping stored in the save. */
export interface GachaMachineState {
  freeRemaining: number;
  /** Epoch of the next allowed free draw — a running timer the daily refill keeps. */
  nextFreeAt: number;
  boxCredits: number;
  lifetimeDraws: number;
}

export interface GachaHistoryEntry {
  machine: MachineId | 'supremeGift';
  speciesId: string;
  star: number;
  tier: Tier;
  isNew: boolean;
  at: number;
}

export interface GachaState {
  /** UTC day key for the free-draw refill. */
  day: string;
  machines: Record<MachineId, GachaMachineState>;
  /** VIP credits toward the Supreme Gift (account-wide, both machines). */
  vipCredits: number;
  /** The Wishing Well's chosen faction, or null. */
  wishFaction: Faction | null;
  /** Most recent draws, newest last, capped. */
  history: GachaHistoryEntry[];
}

/** How many history entries are kept. */
export const GACHA_HISTORY_LIMIT = 50;

export function emptyMachineState(): GachaMachineState {
  return { freeRemaining: 0, nextFreeAt: 0, boxCredits: 0, lifetimeDraws: 0 };
}

export function initialGacha(machineDefs: readonly GachaMachineDef[], day: string): GachaState {
  const machines = {} as Record<MachineId, GachaMachineState>;
  for (const def of machineDefs) {
    machines[def.id] = { ...emptyMachineState(), freeRemaining: def.freePerDay };
  }
  return { day, machines, vipCredits: 0, wishFaction: null, history: [] };
}
