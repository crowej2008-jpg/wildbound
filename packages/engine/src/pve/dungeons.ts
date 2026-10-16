import type { DungeonDef } from './types';

/**
 * Daily dungeons (M8, PROMPT §7.6): one material run per UTC weekday, cleared
 * once a day. Pure. See docs/design/pve-modes.md.
 */

export interface DungeonState {
  /** UTC day-key the `cleared` set belongs to. */
  day: string;
  /** Dungeon ids cleared today. */
  cleared: string[];
}

export function initialDungeonState(day: string): DungeonState {
  return { day, cleared: [] };
}

/** Drop the cleared set when the UTC day rolls over. */
export function rollDungeonDay(state: DungeonState, day: string): DungeonState {
  return state.day === day ? state : { day, cleared: [] };
}

/** The dungeons open on a given weekday (usually one). */
export function dungeonsForWeekday(defs: readonly DungeonDef[], weekday: number): DungeonDef[] {
  return defs.filter((d) => d.weekday === weekday);
}

export function isDungeonCleared(state: DungeonState, id: string): boolean {
  return state.cleared.includes(id);
}

/** Mark a dungeon cleared for the day (idempotent). */
export function markDungeonCleared(state: DungeonState, id: string): DungeonState {
  return isDungeonCleared(state, id) ? state : { ...state, cleared: [...state.cleared, id] };
}
