import type { CampaignProgress, StageDef } from './types';

export type { ChapterDef, CampaignProgress, StageDef, StageEnemy, StageGate, StageReward } from './types';

/**
 * Campaign rules (M5, PROMPT §7.6). Pure and content-free: every function takes
 * the ordered stage list and the progress slice. See docs/design/pve.md.
 */

/** 3 stars under the first threshold, 2 under the second, else 1 (rounds only ever add up). */
export function starsForRounds(rounds: number, thresholds: readonly [number, number]): number {
  const [t3, t2] = thresholds;
  if (rounds <= t3) return 3;
  if (rounds <= t2) return 2;
  return 1;
}

export function isCleared(progress: CampaignProgress, stageId: string): boolean {
  return (progress.stars[stageId] ?? 0) > 0;
}

export function starsOf(progress: CampaignProgress, stageId: string): number {
  return progress.stars[stageId] ?? 0;
}

/** Stage ids in campaign order (chapter, then index). */
export function orderStages(stages: readonly StageDef[]): StageDef[] {
  return [...stages].sort((a, b) => a.chapter - b.chapter || a.index - b.index);
}

export function isGymCleared(progress: CampaignProgress, gymId: string): boolean {
  return progress.gyms?.[gymId] === true;
}

/** Record a gym first clear; safe to call repeatedly. */
export function recordGymClear(progress: CampaignProgress, gymId: string): CampaignProgress {
  return { ...progress, gyms: { ...progress.gyms, [gymId]: true } };
}

/** The gym gate on a stage, or null when the stage is open. */
export function gateOf(stage: StageDef): string | null {
  return stage.gate?.gymId ?? null;
}

/** The gym blocking this stage, or null when the stage is unlocked. */
export function unmetGate(
  progress: CampaignProgress,
  ordered: readonly StageDef[],
  stageId: string,
): string | null {
  const stage = ordered.find((s) => s.id === stageId);
  const gymId = stage ? gateOf(stage) : null;
  return gymId && !isGymCleared(progress, gymId) ? gymId : null;
}

/**
 * The first stage is always open; every other stage needs its predecessor
 * cleared. A gated stage additionally needs its gym defeated (M13.0a).
 */
export function isUnlocked(progress: CampaignProgress, ordered: readonly StageDef[], stageId: string): boolean {
  const i = ordered.findIndex((s) => s.id === stageId);
  if (i < 0) return false;
  const gate = gateOf(ordered[i]!);
  if (gate && !isGymCleared(progress, gate)) return false;
  if (i === 0) return true;
  return isCleared(progress, ordered[i - 1]!.id);
}

/**
 * A gym is available once the stage immediately before its story gate is
 * cleared. A gym that is already cleared stays available for practice.
 */
export function isGymAvailable(
  progress: CampaignProgress,
  ordered: readonly StageDef[],
  gymId: string,
): boolean {
  if (isGymCleared(progress, gymId)) return true;
  const gateIndex = ordered.findIndex((s) => gateOf(s) === gymId);
  if (gateIndex < 0) return false;
  if (gateIndex === 0) return true;
  return isCleared(progress, ordered[gateIndex - 1]!.id);
}

/** The campaign's "go here" target: the first stage that is not yet cleared. */
export function nextStageId(progress: CampaignProgress, ordered: readonly StageDef[]): string | null {
  return ordered.find((s) => !isCleared(progress, s.id))?.id ?? null;
}

/** The cleared stage with the highest idle rate (ties break to the earlier stage). */
export function bestIdleStage(progress: CampaignProgress, ordered: readonly StageDef[]): StageDef | null {
  let best: StageDef | null = null;
  let bestRate = 0;
  for (const stage of ordered) {
    if (!isCleared(progress, stage.id)) continue;
    const rate = stage.idlePerMinute.gold ?? 0;
    if (best === null || rate > bestRate) {
      best = stage;
      bestRate = rate;
    }
  }
  return best;
}

export function totalStars(progress: CampaignProgress): number {
  return Object.values(progress.stars).reduce((sum, n) => sum + n, 0);
}

/** Record a clear, never lowering a stage's best star count or dropping gym clears. */
export function recordStars(progress: CampaignProgress, stageId: string, stars: number): CampaignProgress {
  const best = Math.max(progress.stars[stageId] ?? 0, Math.min(3, Math.max(1, stars)));
  return { ...progress, stars: { ...progress.stars, [stageId]: best } };
}

/** How many stars are still available across the whole campaign. */
export function maxStars(ordered: readonly StageDef[]): number {
  return ordered.length * 3;
}
