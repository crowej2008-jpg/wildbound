import type { Rewards } from '../economy/rewards';

/**
 * The endless tower (M8, PROMPT §7.6). Floors are permanent; the weekly reset
 * replenishes the climb allowance and rotates the featured faction, and each day
 * replenishes the sweep allowance. Pure rules; the tuning is an argument. See
 * docs/design/pve-modes.md.
 */

export interface TowerState {
  /** Highest floor cleared (0 = none). Permanent. */
  floor: number;
  /** New floors attempted since the weekly reset. */
  climbsThisWeek: number;
  /** Sweeps used since the daily reset. */
  sweepsToday: number;
  /** Milestone floors already paid out. */
  claimedMilestones: number[];
  /** UTC day-key of `sweepsToday`. */
  day: string;
  /** ISO week-key of `climbsThisWeek` (the weekly reset boundary). */
  week: string;
}

export interface TowerTuning {
  /** New floors one may clear per week. */
  climbsPerWeek: number;
  /** Sweeps per day. */
  sweepsPerDay: number;
  /** A milestone chest is granted at each multiple of this floor. */
  milestoneEvery: number;
  /** Floors at or below which milestone chests exist. */
  milestoneCap: number;
  /** The mode coin the tower pays. */
  reward: {
    goldBase: number;
    goldPerFloor: number;
    shardBase: number;
    shardPerFloor: number;
    coinBase: number;
    coinPerFloor: number;
    /** Growth stops at this floor (reference: ~floor 550). */
    capFloor: number;
  };
}

export function initialTowerState(day: string, week: string): TowerState {
  return { floor: 0, climbsThisWeek: 0, sweepsToday: 0, claimedMilestones: [], day, week };
}

/** Apply daily/weekly resets without losing permanent progress. */
export function rollTower(state: TowerState, day: string, week: string): TowerState {
  let next = state;
  if (next.week !== week) next = { ...next, week, climbsThisWeek: 0 };
  if (next.day !== day) next = { ...next, day, sweepsToday: 0 };
  return next;
}

/** The floor a climb would attempt (the next after the highest cleared). */
export function nextTowerFloor(state: TowerState): number {
  return state.floor + 1;
}

export function canClimb(state: TowerState, tuning: TowerTuning): boolean {
  return state.climbsThisWeek < tuning.climbsPerWeek;
}

export function canSweep(state: TowerState, tuning: TowerTuning): boolean {
  return state.floor > 0 && state.sweepsToday < tuning.sweepsPerDay;
}

/** Record a successful climb onto `floor`. Caller checks `canClimb` first. */
export function advanceTower(state: TowerState, floor: number): TowerState {
  return { ...state, floor, climbsThisWeek: state.climbsThisWeek + 1 };
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

/** Every milestone floor up to `milestoneCap`. */
export function towerMilestones(tuning: TowerTuning): number[] {
  const out: number[] = [];
  for (let f = tuning.milestoneEvery; f <= tuning.milestoneCap; f += tuning.milestoneEvery) out.push(f);
  return out;
}

/** Milestone floors the player has reached but not yet claimed. */
export function claimableTowerMilestones(state: TowerState, tuning: TowerTuning): number[] {
  return towerMilestones(tuning).filter(
    (f) => f <= state.floor && !state.claimedMilestones.includes(f),
  );
}
