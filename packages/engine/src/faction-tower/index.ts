import type { Faction } from '../model';
import type { Rewards } from '../economy/rewards';
import type { FactionTowerBlock, FactionTowerRules, FactionTowerState, SteppedPay, TowerFaction } from './types';

export * from './types';

/**
 * Faction Tower rules (M13.7). Floors are permanent; the floors-a-day count and the sweeps reset every UTC day.
 * Pure: the tuning is an argument and the clock arrives as a day-key and a weekday.
 */

export function initialFactionTower(day: string): FactionTowerState {
  return { floors: { water: 0, fire: 0, grass: 0 }, climbed: { water: 0, fire: 0, grass: 0 }, sweeps: 0, bought: 0, day };
}

/** Apply the daily reset without losing floors. */
export function rollFactionTower(state: FactionTowerState, day: string): FactionTowerState {
  return state.day === day ? state : { ...state, day, climbed: { water: 0, fire: 0, grass: 0 }, sweeps: 0, bought: 0 };
}

export function towerOpen(rules: FactionTowerRules, faction: TowerFaction, weekday: number): boolean {
  return rules.openDays[faction].includes(weekday);
}

export function nextFactionFloor(state: FactionTowerState, faction: TowerFaction): number {
  return state.floors[faction] + 1;
}

/** Why a tower cannot be climbed now, or null. */
export function climbBlock(rules: FactionTowerRules, state: FactionTowerState, faction: TowerFaction, weekday: number): FactionTowerBlock | null {
  if (state.floors[faction] >= rules.floors) return 'top';
  if (!towerOpen(rules, faction, weekday)) return 'closed';
  if (state.climbed[faction] >= rules.floorsPerDay) return 'daily_limit';
  return null;
}

export function teamsFor(rules: FactionTowerRules, floor: number): 1 | 2 {
  return floor >= rules.twoTeamFrom ? 2 : 1;
}

/** Each fielded faction is the tower's own or an ally, with at least `minOfType` of the tower's own. */
export function lineupBlock(rules: FactionTowerRules, faction: TowerFaction, factions: readonly Faction[]): 'faction' | 'min_type' | null {
  if (factions.some((f) => f !== faction && !rules.allies.includes(f))) return 'faction';
  if (factions.filter((f) => f === faction).length < rules.minOfType) return 'min_type';
  return null;
}

function stepped(line: SteppedPay, floor: number): number {
  return Math.min(line.max, line.base + line.step * Math.floor((Math.max(1, floor) - 1) / line.every));
}

/** What clearing (or sweeping) a floor pays. */
export function factionFloorPay(rules: FactionTowerRules, floor: number): Rewards {
  return {
    gold: stepped(rules.pay.gold, floor),
    starShard: stepped(rules.pay.starShard, floor),
    factionCoin: stepped(rules.pay.factionCoin, floor),
  };
}

/** The one-time bonus on every `bonus.every`-th floor (empty elsewhere). */
export function factionFloorBonus(rules: FactionTowerRules, floor: number): Rewards {
  const b = rules.bonus;
  if (floor <= 0 || floor % b.every !== 0) return {};
  const k = floor / b.atFloor;
  return { factionCoin: Math.round((b.factionCoin * k) / 10) * 10, starShard: Math.round((b.starShard * k) / 50) * 50 };
}

/** Record a cleared floor. Caller checks `climbBlock` first. */
export function clearFactionFloor(state: FactionTowerState, faction: TowerFaction): FactionTowerState {
  return {
    ...state,
    floors: { ...state.floors, [faction]: state.floors[faction] + 1 },
    climbed: { ...state.climbed, [faction]: state.climbed[faction] + 1 },
  };
}

/** The next sweep's Diamond price (0 = free), or null when none are left today. */
export function sweepPrice(rules: FactionTowerRules, state: FactionTowerState): number | null {
  if (state.sweeps < rules.freeSweeps) return 0;
  return rules.sweepPrices[state.bought] ?? null;
}

export function spendFactionSweep(rules: FactionTowerRules, state: FactionTowerState): FactionTowerState {
  return state.sweeps < rules.freeSweeps ? { ...state, sweeps: state.sweeps + 1 } : { ...state, bought: state.bought + 1 };
}
