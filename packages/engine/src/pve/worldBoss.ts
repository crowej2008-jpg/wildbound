import { mulberry32 } from '../rng';
import type { BattleResult } from '../combat/types';
import type { WorldBossDef, WorldBossMilestone } from './types';

/**
 * World Boss rules (M8; R9 from the source). One boss per UTC weekday, up in two windows a day (12:00–13:00 and
 * 18:00–19:00 UTC) with three fights in each; a window's score is its total damage, which reaches the milestones
 * and ranks against stored ghost records (the player's own history plus deterministic bots — the same local
 * pattern M10 Arena uses). Pure. See docs/design/pve-modes.md.
 */

export interface WorldBossWindow {
  startHour: number;
  endHour: number;
}

export interface WorldBossState {
  /** The window key (`YYYY-MM-DDTHH`, the window's start) the counters belong to. */
  day: string;
  /** Fights used in this window. */
  attempts: number;
  /** R9: this window's score (its total damage). */
  score: number;
  /** Damage of the most recent fight. */
  lastDamage: number;
  /** Best damage across all time (shown on the card). */
  bestDamage: number;
  /** Milestone indices already claimed (reset never — they are per-day thresholds). */
  claimedMilestones: number[];
  /** Recent damages, newest last (the ghost ladder seed). */
  history: number[];
}

export function initialWorldBossState(day: string): WorldBossState {
  return { day, attempts: 0, score: 0, lastDamage: 0, bestDamage: 0, claimedMilestones: [], history: [] };
}

/** Reset the window counters when the window changes. */
export function rollWorldBossDay(state: WorldBossState, key: string): WorldBossState {
  if (state.day === key) return state;
  return { ...state, day: key, attempts: 0, score: 0, claimedMilestones: [] };
}

const HOUR = 3_600_000;

/** The window open at `now` (with its key), else the next one to open. */
export function worldBossWindow(
  now: number,
  windows: readonly WorldBossWindow[],
): { open: boolean; key: string; opensAt: number; closesAt: number } {
  const midnight = Math.floor(now / (24 * HOUR)) * 24 * HOUR;
  const keyOf = (start: number) => new Date(start).toISOString().slice(0, 13);
  for (let day = 0; day <= 1; day += 1) {
    for (const w of [...windows].sort((a, b) => a.startHour - b.startHour)) {
      const start = midnight + day * 24 * HOUR + w.startHour * HOUR;
      const end = midnight + day * 24 * HOUR + w.endHour * HOUR;
      if (now < end) return { open: now >= start, key: keyOf(start), opensAt: start, closesAt: end };
    }
  }
  const start = midnight + 24 * HOUR + windows[0]!.startHour * HOUR;
  return { open: false, key: keyOf(start), opensAt: start, closesAt: start + HOUR };
}

/** The rank-reward row for a rank (the first whose `upToRank` covers it), if any. */
export function rankRewardFor<T extends { upToRank: number }>(rank: number, rows: readonly T[]): T | undefined {
  return [...rows].sort((a, b) => a.upToRank - b.upToRank).find((r) => rank <= r.upToRank);
}

export function worldBossForWeekday(defs: readonly WorldBossDef[], weekday: number): WorldBossDef | null {
  return defs.find((d) => d.weekday === weekday) ?? null;
}

export function canChallengeBoss(state: WorldBossState, attemptsPerDay: number): boolean {
  return state.attempts < attemptsPerDay;
}

/** Damage dealt by the attacking side in a battle result. */
export function attackerDamage(result: Pick<BattleResult, 'damageDealt'>): number {
  let total = 0;
  for (const [key, value] of Object.entries(result.damageDealt)) {
    if (key.startsWith('attackers:')) total += value;
  }
  return Math.floor(total);
}

/** Record a scored fight; keeps the last `historyCap` runs for the ghost ladder. */
export function recordBossDamage(
  state: WorldBossState,
  damage: number,
  historyCap: number,
): WorldBossState {
  const d = Math.max(0, Math.floor(damage));
  const history = [...state.history, d].slice(-Math.max(1, historyCap));
  return {
    ...state,
    attempts: state.attempts + 1,
    score: state.score + d,
    lastDamage: d,
    bestDamage: Math.max(state.bestDamage, d),
    history,
  };
}

/** Indices of milestones whose threshold the given damage has reached. */
export function reachedMilestones(damage: number, milestones: readonly WorldBossMilestone[]): number[] {
  return milestones.map((m, i) => (damage >= m.damage ? i : -1)).filter((i) => i >= 0);
}

/** Milestone indices reached today but not yet claimed. */
export function claimableMilestones(
  state: WorldBossState,
  damage: number,
  milestones: readonly WorldBossMilestone[],
): number[] {
  return reachedMilestones(damage, milestones).filter((i) => !state.claimedMilestones.includes(i));
}

/**
 * Deterministic bot ghost records for the leaderboard: the player's own history
 * plus `count` bots scaled around the player's best. Same inputs → same ghosts.
 */
export function ghostRecords(history: readonly number[], seed: number, count: number): number[] {
  const rng = mulberry32(seed);
  const top = Math.max(1, ...history);
  const bots: number[] = [];
  for (let i = 0; i < Math.max(0, count); i += 1) {
    // Spread bots from ~40% to ~160% of the player's best, weighted low.
    const factor = 0.4 + rng() * 1.2;
    bots.push(Math.floor(top * factor));
  }
  return bots;
}

/** 1-based competition rank of `damage` against the ghost ladder (ties share a rank). */
export function rankDamage(damage: number, ghosts: readonly number[]): number {
  let better = 0;
  for (const g of ghosts) if (g > damage) better += 1;
  return better + 1;
}
