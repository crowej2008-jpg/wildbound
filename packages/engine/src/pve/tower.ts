import type { Rewards } from '../economy/rewards';

/**
 * The Pokémon Tower (M8; R9 from the source): the Normal tower (1,000 floors) and the Hard tower (750 floors, each
 * stage of five with a lineup rule). Floors are permanent; the climbs and sweeps reset every day. Pure rules; the
 * tuning is an argument. See docs/design/pve-modes.md.
 */

export type TowerKind = 'normal' | 'hard';

export interface TowerState {
  /** Highest Normal floor cleared (0 = none). Permanent. */
  floor: number;
  /** Highest Hard floor cleared (0 = none). Permanent. */
  hardFloor: number;
  /** Climbs used today (Normal and Hard each). */
  climbsToday: number;
  hardClimbsToday: number;
  /** Sweeps used today. */
  sweepsToday: number;
  /** UTC day-key of the daily counters. */
  day: string;
}

export interface TowerTuning {
  /** Climbs a day, in each tower. */
  climbsPerDay: number;
  /** Sweeps per day. */
  sweepsPerDay: number;
  /** Each tower's floor count. */
  normalFloors: number;
  hardFloors: number;
  /** The stand-in per-floor pay (the source's floor drops are not in the dumps). */
  reward: {
    goldBase: number;
    goldPerFloor: number;
    shardBase: number;
    shardPerFloor: number;
    coinBase: number;
    coinPerFloor: number;
    capFloor: number;
  };
}

export function initialTowerState(day: string): TowerState {
  return { floor: 0, hardFloor: 0, climbsToday: 0, hardClimbsToday: 0, sweepsToday: 0, day };
}

/** Apply the daily reset without losing permanent progress. */
export function rollTower(state: TowerState, day: string): TowerState {
  return state.day === day ? state : { ...state, day, climbsToday: 0, hardClimbsToday: 0, sweepsToday: 0 };
}

/** The floor a climb would attempt (the next after the highest cleared). */
export function nextTowerFloor(state: TowerState, kind: TowerKind = 'normal'): number {
  return (kind === 'hard' ? state.hardFloor : state.floor) + 1;
}

export function canClimb(state: TowerState, tuning: TowerTuning, kind: TowerKind = 'normal'): boolean {
  const used = kind === 'hard' ? state.hardClimbsToday : state.climbsToday;
  const top = kind === 'hard' ? tuning.hardFloors : tuning.normalFloors;
  return used < tuning.climbsPerDay && nextTowerFloor(state, kind) <= top;
}

export function canSweep(state: TowerState, tuning: TowerTuning): boolean {
  return state.floor > 0 && state.sweepsToday < tuning.sweepsPerDay;
}

/** Record a successful climb onto `floor`. Caller checks `canClimb` first. */
export function advanceTower(state: TowerState, floor: number, kind: TowerKind = 'normal'): TowerState {
  return kind === 'hard'
    ? { ...state, hardFloor: floor, hardClimbsToday: state.hardClimbsToday + 1 }
    : { ...state, floor, climbsToday: state.climbsToday + 1 };
}

/** A lost climb still uses one of the day's climbs. */
export function spendClimb(state: TowerState, kind: TowerKind = 'normal'): TowerState {
  return kind === 'hard' ? { ...state, hardClimbsToday: state.hardClimbsToday + 1 } : { ...state, climbsToday: state.climbsToday + 1 };
}

export function spendSweep(state: TowerState): TowerState {
  return { ...state, sweepsToday: state.sweepsToday + 1 };
}

/** The reward for clearing `floor`, flattened after `capFloor`. */
export function towerFloorReward(floor: number, tuning: TowerTuning): Rewards {
  const f = Math.max(1, Math.floor(floor));
  const at = Math.min(f, tuning.reward.capFloor);
  return {
    gold: tuning.reward.goldBase + tuning.reward.goldPerFloor * at,
    shard: tuning.reward.shardBase + tuning.reward.shardPerFloor * at,
    wildCoin: tuning.reward.coinBase + tuning.reward.coinPerFloor * at,
  };
}
