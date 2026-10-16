import { mulberry32 } from '../rng';
import type { BattleResult } from '../combat/types';
import type { WorldBossDef, WorldBossMilestone } from './types';

/**
 * World Boss rules (M8, PROMPT §7.6). One boss per UTC weekday, a limited number
 * of scored fights per day, damage milestones, and a damage ranking against
 * stored ghost records (the player's own history plus deterministic bots — the
 * same local pattern M10 Arena uses). Pure. See docs/design/pve-modes.md.
 */

export interface WorldBossState {
  /** UTC day-key of the attempts/best-damage counters. */
  day: string;
  /** Fights used today. */
  attempts: number;
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
  return { day, attempts: 0, lastDamage: 0, bestDamage: 0, claimedMilestones: [], history: [] };
}

/** Reset the per-day counters when the UTC day changes. */
export function rollWorldBossDay(state: WorldBossState, day: string): WorldBossState {
  if (state.day === day) return state;
  return { ...state, day, attempts: 0, claimedMilestones: [] };
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
