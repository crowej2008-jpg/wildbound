import type { DungeonGradeGoal } from './types';

/**
 * R9 daily dungeons, from the source (dun_basic_json, dun_score_reward_json): four dungeons open every day, each
 * with ten difficulties and two runs a day (fight or sweep). A fight is graded C / B / A / S by kills or damage
 * within the rounds; each difficulty-and-grade chest is paid once ever. Pure.
 */

export type DungeonGrade = DungeonGradeGoal['grade'];
const ORDER: DungeonGrade[] = ['C', 'B', 'A', 'S'];

export interface DungeonState {
  /** UTC day-key the run counts belong to. */
  day: string;
  /** Runs used today, by dungeon id. */
  runs: Record<string, number>;
  /** Best grade ever reached, by difficulty id. */
  best: Record<string, DungeonGrade>;
  /** Grade chests already drawn (`difficultyId:grade`); never refilled. */
  chests: string[];
}

export function initialDungeonState(day: string): DungeonState {
  return { day, runs: {}, best: {}, chests: [] };
}

/** The runs reset at the UTC day roll; grades and chests stay. */
export function rollDungeonDay(state: DungeonState, day: string): DungeonState {
  return state.day === day ? state : { ...state, day, runs: {} };
}

/** The highest grade a fight earned (null = no grade). */
export function dungeonGrade(goals: readonly DungeonGradeGoal[], result: { kills: number; damage: number; rounds: number }): DungeonGrade | null {
  let reached: DungeonGrade | null = null;
  for (const g of goals) {
    const met =
      (g.kills === undefined || result.kills >= g.kills) &&
      (g.damage === undefined || result.damage >= g.damage) &&
      (g.rounds === undefined || result.rounds <= g.rounds);
    if (met && (reached === null || ORDER.indexOf(g.grade) > ORDER.indexOf(reached))) reached = g.grade;
  }
  return reached;
}

export function betterGrade(a: DungeonGrade | undefined, b: DungeonGrade | null): DungeonGrade | undefined {
  if (b === null) return a;
  if (a === undefined) return b;
  return ORDER.indexOf(b) > ORDER.indexOf(a) ? b : a;
}

/** Grades at or below `best` whose chest is not drawn yet. */
export function openChests(state: DungeonState, difficultyId: string): DungeonGrade[] {
  const best = state.best[difficultyId];
  if (!best) return [];
  return ORDER.slice(0, ORDER.indexOf(best) + 1).filter((g) => !state.chests.includes(`${difficultyId}:${g}`));
}
