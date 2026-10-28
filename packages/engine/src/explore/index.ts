import { isCleared } from '../campaign';
import type { CampaignProgress } from '../campaign/types';
import { nextWeekStart } from '../pve/reset';
import { UTC_DAY_MS, nextUtcMidnight } from '../time';

/**
 * Explore hub rules (M13.0b). Pure: the caller supplies the campaign progress,
 * trainer level and server day. See docs/design/explore.md.
 */

export type ExploreReset = 'daily' | 'weekly' | 'permanent';

export type ExploreGate =
  | { kind: 'campaign'; chapter: number; stage: number }
  | { kind: 'level'; level: number }
  | { kind: 'serverDay'; day: number };

export interface ExploreContext {
  campaign: CampaignProgress;
  level: number;
  serverDay: number;
}

export interface ExploreGateStatus {
  gate: ExploreGate;
  met: boolean;
  current: number;
  required: number;
  /** Present on campaign gates: the stage id to clear. */
  stageId?: string;
}

export interface ExploreAccess {
  unlocked: boolean;
  gates: ExploreGateStatus[];
}

/** Account age in whole server days; day 1 is the creation day. */
export function serverDay(now: number, epoch: number): number {
  if (!Number.isFinite(now) || !Number.isFinite(epoch)) return 1;
  return Math.max(1, Math.floor((now - epoch) / UTC_DAY_MS) + 1);
}

function gateStatus(gate: ExploreGate, context: ExploreContext): ExploreGateStatus {
  if (gate.kind === 'campaign') {
    const stageId = `c${gate.chapter}-${gate.stage}`;
    const current = isCleared(context.campaign, stageId) ? 1 : 0;
    return { gate, met: current >= 1, current, required: 1, stageId };
  }
  if (gate.kind === 'level') {
    return { gate, met: context.level >= gate.level, current: context.level, required: gate.level };
  }
  const day = Math.max(1, Math.floor(context.serverDay));
  return { gate, met: day >= gate.day, current: day, required: gate.day };
}

/** Evaluate every gate; the mode is open only when all of them are met. */
export function exploreAccess(
  gates: readonly ExploreGate[],
  context: ExploreContext,
): ExploreAccess {
  const statuses = gates.map((gate) => gateStatus(gate, context));
  return { unlocked: statuses.every((status) => status.met), gates: statuses };
}

/** Milliseconds until the next reset, or null for a permanent mode. */
export function nextResetMs(reset: ExploreReset, now: number): number | null {
  switch (reset) {
    case 'daily':
      return nextUtcMidnight(now) - now;
    case 'weekly':
      return nextWeekStart(now) - now;
    case 'permanent':
      return null;
  }
}
