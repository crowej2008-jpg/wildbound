import { scaleRewards, type Rewards } from './rewards';

/**
 * Idle / offline income (M5, PROMPT §7.4). Accrues per minute from the best
 * cleared campaign stage, capped over a fixed window, and is claimed by hand.
 */

/** Per-account idle bookkeeping stored in the save. */
export interface IdleState {
  bestStageId: string | null;
  lastClaimAt: number;
  /** UTC day key of the last quick-collect, for the daily limit. */
  quickClaimDay: string;
  quickClaims: number;
}

export function initialIdle(now: number, day: string): IdleState {
  return { bestStageId: null, lastClaimAt: now, quickClaimDay: day, quickClaims: 0 };
}

/** Whole minutes accrued since `lastClaimAt`, clamped to `[0, capMinutes]`. */
export function accruedMinutes(lastClaimAt: number, now: number, capMinutes: number): number {
  const raw = Math.floor((now - lastClaimAt) / 60_000);
  return Math.max(0, Math.min(capMinutes, raw));
}

/** The idle payout for a span of minutes at a per-minute rate. */
export function idleReward(ratePerMinute: Rewards, minutes: number): Rewards {
  return scaleRewards(ratePerMinute, minutes);
}

/** Pending idle payout right now, without mutating anything. */
export function pendingIdle(ratePerMinute: Rewards, lastClaimAt: number, now: number, capMinutes: number): Rewards {
  return idleReward(ratePerMinute, accruedMinutes(lastClaimAt, now, capMinutes));
}

/** How much of a rate is still accruable (so quick-collect can top up to the cap). */
export function remainingIdle(ratePerMinute: Rewards, lastClaimAt: number, now: number, capMinutes: number): Rewards {
  const remainingMinutes = capMinutes - accruedMinutes(lastClaimAt, now, capMinutes);
  return idleReward(ratePerMinute, remainingMinutes);
}

/** Quick-collect grants a fixed slice for a gem cost (bounded by the remaining cap). */
export function quickCollect(
  ratePerMinute: Rewards,
  lastClaimAt: number,
  now: number,
  capMinutes: number,
  quickMinutes: number,
): Rewards {
  const minutes = Math.min(quickMinutes, capMinutes - accruedMinutes(lastClaimAt, now, capMinutes));
  return idleReward(ratePerMinute, minutes);
}
