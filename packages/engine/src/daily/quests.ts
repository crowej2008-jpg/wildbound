import type { Rewards } from '../economy/rewards';

/**
 * Daily quests, activity points and chests (M5, PROMPT §7.9). Progress is keyed
 * by *metric*, so several quests can share one counter (e.g. win 3 and win 10).
 */

export type QuestMetric = 'winBattle' | 'sweepStage' | 'levelUp' | 'starUp' | 'claimIdle' | 'claimQuest';

export interface QuestDef {
  id: string;
  metric: QuestMetric;
  target: number;
  /** Activity points granted when the quest is claimed. */
  activity: number;
  rewards: Rewards;
}

/** Per-day quest bookkeeping stored in the save. */
export interface QuestState {
  /** UTC day key; a mismatch triggers the daily reset. */
  day: string;
  progress: Record<string, number>;
  claimed: string[];
  /** Indices of claimed activity chests for the day. */
  chests: number[];
}

export function emptyQuestState(day: string): QuestState {
  return { day, progress: {}, claimed: [], chests: [] };
}

/** Bump the counter for a metric; returns a new state (missing metric counts as 0). */
export function addQuestProgress(state: QuestState, metric: QuestMetric, amount = 1): QuestState {
  if (amount === 0) return state;
  return { ...state, progress: { ...state.progress, [metric]: (state.progress[metric] ?? 0) + amount } };
}

export function questProgress(state: QuestState, def: QuestDef): number {
  return state.progress[def.metric] ?? 0;
}

export function isQuestComplete(state: QuestState, def: QuestDef): boolean {
  return questProgress(state, def) >= def.target;
}

export function isQuestClaimed(state: QuestState, def: QuestDef): boolean {
  return state.claimed.includes(def.id);
}

export function isQuestClaimable(state: QuestState, def: QuestDef): boolean {
  return isQuestComplete(state, def) && !isQuestClaimed(state, def);
}

export function claimQuest(state: QuestState, id: string): QuestState {
  if (state.claimed.includes(id)) return state;
  return { ...state, claimed: [...state.claimed, id] };
}

/** Activity points earned so far this day (the sum claimed quests pay). */
export function activityPoints(defs: readonly QuestDef[], state: QuestState): number {
  let total = 0;
  for (const def of defs) if (isQuestClaimed(state, def)) total += def.activity;
  return total;
}

/** Chest indices whose activity threshold is reached and not yet claimed. */
export function claimableChests(defs: readonly QuestDef[], state: QuestState, thresholds: readonly number[]): number[] {
  const points = activityPoints(defs, state);
  return thresholds
    .map((_, i) => i)
    .filter((i) => points >= (thresholds[i] ?? Infinity) && !state.chests.includes(i));
}

export function claimChest(state: QuestState, index: number): QuestState {
  if (state.chests.includes(index)) return state;
  return { ...state, chests: [...state.chests, index] };
}
