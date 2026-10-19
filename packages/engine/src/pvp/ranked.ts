import { UTC_DAY_MS, dayKey } from '../time';
import { weekKey } from '../pve/reset';
import type { DanInfo, RankedScoreResult, RankedState, RankedTuning } from './types';

/**
 * Ranked ladder rules (M10, PROMPT §7.7). Twelve tiers a phase (the reference's
 * Vanguard I … King), a win/loss scoring model with the *threshold stop* and a
 * promotion match, a weekly season, and a per-phase challenge-gift track. Pure:
 * the clock and PRNG live with the caller. See docs/design/pvp.md.
 */

const HOUR_MS = 3_600_000;
/** 03:00 UTC — the ladder's daily update boundary. */
const UPDATE_HOUR = 3;

/**
 * The 12 tiers map to the reference's dan layout `phase × 1000 + group × 100 +
 * tier`: three Vanguard, three Elite, three Commander, then Legend, Overlord and
 * King (one each). Only the *layout* lives in code; the names are content.
 */
const DAN_LAYOUT: readonly (readonly [number, number])[] = [
  [1, 1],
  [1, 2],
  [1, 3],
  [2, 1],
  [2, 2],
  [2, 3],
  [3, 1],
  [3, 2],
  [3, 3],
  [4, 1],
  [5, 1],
  [6, 1],
];

export function initialRankedState(phase: number, day: string, season: string): RankedState {
  return {
    phase,
    tier: 0,
    score: 0,
    day,
    attempts: 0,
    bought: 0,
    matches: 0,
    claimedTiers: [],
    claimedGifts: [],
    season,
    wins: 0,
    losses: 0,
    dayWins: 0,
    dayBattles: 0,
    streak: 0,
    bestStreak: 0,
  };
}

/** The dan id of a tier (`phase` 1-based, per the reference). */
export function danId(phaseIndex: number, tierIndex: number): number {
  const layout = DAN_LAYOUT[tierIndex] ?? DAN_LAYOUT[0]!;
  return (phaseIndex + 1) * 1000 + layout[0] * 100 + layout[1];
}

export function decodeDan(dan: number): DanInfo {
  const phase = Math.floor(dan / 1000);
  const group = Math.floor((dan % 1000) / 100);
  const tier = dan % 100;
  const tierIndex = DAN_LAYOUT.findIndex(([g, t]) => g === group && t === tier);
  return { phase, group, tier, tierIndex: tierIndex < 0 ? 0 : tierIndex };
}

/** The index of the next tier, or the current one at the top (no promotion past King). */
export function nextTierIndex(tierIndex: number, tuning: RankedTuning): number {
  return Math.min(tuning.tiers.length - 1, tierIndex + 1);
}

/**
 * Score one Ranked match.
 *
 * Below the next tier's threshold a win adds `winScore` and a loss adds
 * `lossScore` (losses climb too), both clamped to that threshold — the "points
 * stop". At the stop the match is the **promotion match**: a win promotes and
 * still adds `winScore` on top of the threshold; a loss deducts `lossScore`
 * (floored at the current tier's threshold). The top tier never promotes.
 */
export function scoreAfter(
  score: number,
  tier: number,
  tuning: RankedTuning,
  win: boolean,
): RankedScoreResult {
  const tiers = tuning.tiers;
  const last = tiers.length - 1;
  const floor = tiers[tier]?.score ?? 0;
  const atThreshold = tier < last && score >= (tiers[tier + 1]?.score ?? Number.POSITIVE_INFINITY);

  if (win) {
    if (atThreshold) {
      const next = nextTierIndex(tier, tuning);
      return { score: (tiers[next]?.score ?? floor) + tuning.winScore, tier: next, promoted: next !== tier };
    }
    const ceil = tier < last ? (tiers[tier + 1]?.score ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
    return { score: Math.min(ceil, score + tuning.winScore), tier, promoted: false };
  }

  if (atThreshold) {
    return { score: Math.max(floor, score - tuning.lossScore), tier, promoted: false };
  }
  const ceil = tier < last ? (tiers[tier + 1]?.score ?? Number.POSITIVE_INFINITY) : Number.POSITIVE_INFINITY;
  return { score: Math.min(ceil, score + tuning.lossScore), tier, promoted: false };
}

/** Apply one Ranked match: score, tier, attempts, season/today counters and streak. */
export function recordRankedMatch(
  state: RankedState,
  win: boolean,
  tuning: RankedTuning,
): RankedState {
  const result = scoreAfter(state.score, state.tier, tuning, win);
  const streak = win ? state.streak + 1 : 0;
  return {
    ...state,
    tier: result.tier,
    score: result.score,
    attempts: state.attempts + 1,
    matches: state.matches + 1,
    wins: state.wins + (win ? 1 : 0),
    losses: state.losses + (win ? 0 : 1),
    dayWins: state.dayWins + (win ? 1 : 0),
    dayBattles: state.dayBattles + 1,
    streak,
    bestStreak: Math.max(state.bestStreak, streak),
  };
}

// --- Season window ---------------------------------------------------------

/** The ladder day-key: the day starting at 03:00 UTC (attempts reset there). */
export function rankedDayKey(ms: number): string {
  return dayKey(ms - UPDATE_HOUR * HOUR_MS);
}

/** The ISO week key a timestamp's season belongs to (the weather rotation key). */
export function seasonKey(ms: number): string {
  return weekKey(ms);
}

/** Epoch of this season's Monday 03:00 UTC. */
export function seasonOpenAt(ms: number): number {
  const shifted = ms - UPDATE_HOUR * HOUR_MS;
  const dayStart = Math.floor(shifted / UTC_DAY_MS) * UTC_DAY_MS;
  const dayNum = new Date(dayStart).getUTCDay(); // 0 = Sunday
  const daysSinceMonday = (dayNum + 6) % 7;
  return dayStart - daysSinceMonday * UTC_DAY_MS + UPDATE_HOUR * HOUR_MS;
}

/** Epoch of this season's Sunday 22:00 UTC close. */
export function seasonClosedAt(ms: number): number {
  return seasonOpenAt(ms) + 6 * UTC_DAY_MS + (22 - UPDATE_HOUR) * HOUR_MS;
}

export function isSeasonOpen(ms: number): boolean {
  return ms >= seasonOpenAt(ms) && ms < seasonClosedAt(ms);
}

/** True during the 03:00–05:00 UTC daily data update (matching is paused). */
export function inDailyPause(ms: number): boolean {
  const hour = new Date(ms).getUTCHours();
  return hour >= UPDATE_HOUR && hour < 5;
}

/** Restore the day's attempts and bought count when the ladder day changes. */
export function rollRankedDay(state: RankedState, day: string): RankedState {
  if (state.day === day) return state;
  return { ...state, day, attempts: 0, bought: 0, dayWins: 0, dayBattles: 0 };
}

/**
 * Reset the tier track and the season counters when the season turns. With a
 * `phaseCount` the region also advances (cycling), so the eight regions all get
 * played over time — our rule; the reference does not publish one.
 */
export function rollRankedSeason(state: RankedState, season: string, phaseCount?: number): RankedState {
  if (state.season === season) return state;
  return {
    ...state,
    season,
    ...(phaseCount !== undefined && phaseCount > 0 ? { phase: (state.phase + 1) % phaseCount } : {}),
    tier: 0,
    score: 0,
    matches: 0,
    claimedTiers: [],
    claimedGifts: [],
    wins: 0,
    losses: 0,
    dayWins: 0,
    dayBattles: 0,
    streak: 0,
    bestStreak: 0,
    attempts: 0,
    bought: 0,
  };
}

// --- Attempts --------------------------------------------------------------

export function canChallengeRanked(state: RankedState, tuning: RankedTuning): boolean {
  return state.attempts < tuning.freeAttemptsPerDay + state.bought;
}

/** Gems for the next bought attempt (the last price repeats past the table). */
export function rankedAttemptPrice(state: RankedState, tuning: RankedTuning): number {
  const prices = tuning.attemptPrices;
  if (prices.length === 0) return 0;
  return prices[Math.min(state.bought, prices.length - 1)]!;
}

export function buyRankedAttempt(state: RankedState): RankedState {
  return { ...state, bought: state.bought + 1 };
}

// --- Claims ----------------------------------------------------------------

/** Tier indices at or below the current tier, not yet claimed. */
export function claimableTiers(state: RankedState): number[] {
  const out: number[] = [];
  for (let i = 0; i <= state.tier; i += 1) {
    if (!state.claimedTiers.includes(i)) out.push(i);
  }
  return out;
}

export function claimTier(state: RankedState, index: number): RankedState {
  if (state.claimedTiers.includes(index)) return state;
  return { ...state, claimedTiers: [...state.claimedTiers, index] };
}

/** Gift-track indices reached (by season match count) but not yet claimed. */
export function claimableGifts(state: RankedState, tuning: RankedTuning): number[] {
  return tuning.giftTrack
    .map((gift, i) => (state.matches >= gift.matches ? i : -1))
    .filter((i) => i >= 0 && !state.claimedGifts.includes(i));
}

export function claimGift(state: RankedState, index: number): RankedState {
  if (state.claimedGifts.includes(index)) return state;
  return { ...state, claimedGifts: [...state.claimedGifts, index] };
}

/** The current tier's threshold and the next tier (for the "Next Rank" readout). */
export function tierProgress(
  state: RankedState,
  tuning: RankedTuning,
): { floor: number; nextIndex: number | null; nextScore: number | null } {
  const floor = tuning.tiers[state.tier]?.score ?? 0;
  const nextIndex = state.tier + 1 < tuning.tiers.length ? state.tier + 1 : null;
  const nextScore = nextIndex === null ? null : (tuning.tiers[nextIndex]?.score ?? null);
  return { floor, nextIndex, nextScore };
}
