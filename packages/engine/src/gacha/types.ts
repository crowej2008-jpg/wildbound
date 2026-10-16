import type { Tier } from '../model';
import type { Rewards } from '../economy/rewards';

/**
 * Summoning (gacha) vocabulary (M6, PROMPT §7.5). Pure types + tiny helpers; the
 * roll rules live in `gacha.ts`, the data lives in `content/tuning/gacha.json`.
 * See docs/design/gacha.md.
 */

export type MachineId = 'common' | 'premium';

export const MACHINE_IDS: readonly MachineId[] = ['common', 'premium'];

/** Cheapest first — the guarantees ("this tier or better") order against this. */
export const TIER_ORDER: readonly Tier[] = [
  'common',
  'rare',
  'epic',
  'legendary',
  'supreme',
  'mythic',
];

export function tierRank(tier: Tier): number {
  return TIER_ORDER.indexOf(tier);
}

export function isAtLeast(tier: Tier, floor: Tier): boolean {
  return tierRank(tier) >= tierRank(floor);
}

/** One row of a machine's rate table: a tier and its relative weight. */
export interface GachaTierWeight {
  tier: Tier;
  weight: number;
}

/** A machine's full tuning (PROMPT §7.5). */
export interface GachaMachineDef {
  id: MachineId;
  /** Ticket currency id (a `CurrencyId`). */
  ticket: string;
  /** Gem price for a single / ten draw; null = no gem fallback. */
  gemPerDraw: number | null;
  gemPerTen: number | null;
  freePerDay: number;
  freeCooldownMinutes: number;
  /** Credits added per draw. */
  creditPerDraw: number;
  /** Credits needed to claim one box (0 = no box). */
  boxCreditsNeeded: number;
  boxRewards: Rewards;
  /** Credits needed to force a Legendary-or-better draw (0 = no pity). */
  pityThreshold: number;
  /** Wish support (Premium only). */
  wish: boolean;
  wishBoost: number;
  /** Lifetime draws needed before the wish opens (0 = always). */
  wishUnlockDraws: number;
  /** Every ten-draw guarantees one draw of this tier or better. */
  tenDrawGuarantee: Tier;
  rates: GachaTierWeight[];
}

/** A species in the summon pool, tagged with its tier. */
export interface GachaPoolEntry {
  speciesId: string;
  tier: Tier;
}

/** One draw's outcome. */
export interface DrawResult {
  speciesId: string;
  tier: Tier;
  /** The species was not in the roster before this batch of draws. */
  isNew: boolean;
  /** Forced by the ten-draw guarantee or the pity rule. */
  guaranteed: boolean;
}

/** Per-machine bookkeeping stored in the save. */
export interface GachaMachineState {
  freeRemaining: number;
  /** Epoch of the next allowed free draw (cooldown). */
  nextFreeAt: number;
  boxCredits: number;
  pityCredits: number;
  lifetimeDraws: number;
}

export interface GachaHistoryEntry {
  machine: MachineId;
  speciesId: string;
  tier: Tier;
  isNew: boolean;
  at: number;
}

export interface GachaState {
  /** UTC day key for the free-draw refill. */
  day: string;
  machines: Record<MachineId, GachaMachineState>;
  /** Premium featured target (a species id) or null. */
  wishedSpeciesId: string | null;
  /** Most recent draws, newest last, capped. */
  history: GachaHistoryEntry[];
}

/** How many history entries are kept. */
export const GACHA_HISTORY_LIMIT = 50;

export function emptyMachineState(): GachaMachineState {
  return { freeRemaining: 0, nextFreeAt: 0, boxCredits: 0, pityCredits: 0, lifetimeDraws: 0 };
}

/** A machine's free draws are refilled when the UTC day rolls over. */
export function initialGacha(machineDefs: readonly GachaMachineDef[], day: string): GachaState {
  const machines = {} as Record<MachineId, GachaMachineState>;
  for (const def of machineDefs) {
    machines[def.id] = { ...emptyMachineState(), freeRemaining: def.freePerDay };
  }
  return { day, machines, wishedSpeciesId: null, history: [] };
}
