import type { Faction } from '../model';
import type { Rewards } from '../economy/rewards';

/**
 * Faction Tower (M13.7) vocabulary. Three type-locked towers — Water, Fire and Grass — each 1,000 floors, open on
 * fixed weekdays (all three on Sunday). Pure types; the tuning comes from packages/content/tuning/faction-tower.json.
 * See docs/design/faction-tower.md.
 */

export type TowerFaction = 'water' | 'fire' | 'grass';

export const TOWER_FACTIONS: readonly TowerFaction[] = ['water', 'fire', 'grass'];

export interface FactionTowerState {
  /** Highest floor cleared in each tower (0 = none). Permanent. */
  floors: Record<TowerFaction, number>;
  /** Floors cleared today in each tower. */
  climbed: Record<TowerFaction, number>;
  /** Free sweeps used today (shared by the towers). */
  sweeps: number;
  /** Diamond sweeps bought today. */
  bought: number;
  /** UTC day-key of the daily counters. */
  day: string;
}

/** One stepped reward line: base + step for every `every` floors past the first, never above max. */
export interface SteppedPay {
  base: number;
  step: number;
  every: number;
  max: number;
}

export interface FactionTowerRules {
  floors: number;
  /** Floors a tower can be cleared a day. */
  floorsPerDay: number;
  /** From this floor on a climb needs two teams against twelve enemies. */
  twoTeamFrom: number;
  /** At least this many of the tower's own faction in each team. */
  minOfType: number;
  /** Factions any tower also admits. */
  allies: Faction[];
  /** UTC weekdays (0 = Sunday) each tower is open. */
  openDays: Record<TowerFaction, number[]>;
  freeSweeps: number;
  /** Diamond price of each bought sweep in a day, in order (its length is the day's limit). */
  sweepPrices: number[];
  /** Per-floor pay (each clear, and a sweep of the highest floor). */
  pay: { gold: SteppedPay; starShard: SteppedPay; factionCoin: SteppedPay };
  /** One-time bonus every `every` floors, scaled from the one known point (stand-in). */
  bonus: { every: number; atFloor: number; factionCoin: number; starShard: number };
}

/** A tower milestone (source achievements): its rewards plus random Pokémon from the tower's evolve box. */
export interface FactionTowerMilestone {
  faction: TowerFaction;
  floor: number;
  rewards: Rewards;
  evolveBox: number;
}

export type FactionTowerBlock = 'closed' | 'daily_limit' | 'top';
