import type { Rewards } from '../economy/rewards';
import type { ArenaBand, ArenaState, ArenaTuning } from './types';

/**
 * Arena rules (M10, PROMPT §7.7). Credits move on a win/loss, decide the weekly
 * rank, and reset to the band floor at the Monday settlement; participation
 * chests and best-rank achievements are claimable. Pure: the clock and PRNG live
 * with the caller. See docs/design/pvp.md.
 */

export function initialArenaState(day: string, weekKey: string): ArenaState {
  return {
    credits: 0,
    bestCredits: 0,
    bestPlace: 0,
    day,
    attempts: 0,
    bought: 0,
    opponentSeed: 0,
    battleCount: 0,
    claimedChests: [],
    claimedAchievements: [],
    weekKey,
  };
}

/** Credits after a battle: `+perWin` on a win, `-perLoss` on a loss, clamped to `[0, cap]`. */
export function creditsAfter(credits: number, win: boolean, tuning: ArenaTuning): number {
  const delta = win ? tuning.creditsPerWin : -tuning.creditsPerLoss;
  return Math.max(0, Math.min(tuning.creditCap, Math.floor(credits + delta)));
}

/** Index of the band whose `[minCredits, nextMinCredits)` contains `credits`. */
export function arenaBandIndex(credits: number, bands: readonly ArenaBand[]): number {
  let index = 0;
  for (let i = 0; i < bands.length; i += 1) {
    if (credits >= bands[i]!.minCredits) index = i;
  }
  return index;
}

export function arenaBand(credits: number, bands: readonly ArenaBand[]): ArenaBand {
  const band = bands[arenaBandIndex(credits, bands)];
  if (!band) throw new Error('arena has no bands');
  return band;
}

/** "My Ranking": the place number for a credit value (1 is best). */
export function arenaRank(credits: number, bands: readonly ArenaBand[]): number {
  const band = arenaBand(credits, bands);
  return Math.max(1, band.startPlace - (Math.floor(credits) - band.minCredits));
}

/** Reset the per-day counters when the UTC day changes. */
export function rollArenaDay(state: ArenaState, day: string): ArenaState {
  if (state.day === day) return state;
  return { ...state, day, attempts: 0, bought: 0, battleCount: 0, claimedChests: [] };
}

export function canChallengeArena(state: ArenaState, tuning: ArenaTuning): boolean {
  return state.attempts < tuning.freeAttemptsPerDay + state.bought;
}

/** Gems for the next bought attempt (the last price repeats past the table). */
export function arenaAttemptPrice(state: ArenaState, tuning: ArenaTuning): number {
  const prices = tuning.attemptPrices;
  if (prices.length === 0) return 0;
  return prices[Math.min(state.bought, prices.length - 1)]!;
}

/** Bump the bought counter; the caller pays `arenaAttemptPrice` beforehand. */
export function buyArenaAttempt(state: ArenaState): ArenaState {
  return { ...state, bought: state.bought + 1 };
}

/** Reroll the day's three opponents (the caller bounds how often). */
export function refreshArena(state: ArenaState): ArenaState {
  return { ...state, opponentSeed: state.opponentSeed + 1 };
}

/**
 * Apply one Arena battle: move credits, advance the best-ever readings, and count
 * the attempt and the day's chest progress.
 */
export function recordArenaBattle(state: ArenaState, win: boolean, tuning: ArenaTuning): ArenaState {
  const credits = creditsAfter(state.credits, win, tuning);
  const place = arenaRank(credits, tuning.bands);
  return {
    ...state,
    credits,
    bestCredits: Math.max(state.bestCredits, credits),
    bestPlace: state.bestPlace === 0 ? place : Math.min(state.bestPlace, place),
    attempts: state.attempts + 1,
    battleCount: state.battleCount + 1,
  };
}

/** Chest indices reached today (by battle count). */
export function reachedArenaChests(state: ArenaState, tuning: ArenaTuning): number[] {
  return tuning.chestTiers
    .map((tier, i) => (state.battleCount >= tier.battles ? i : -1))
    .filter((i) => i >= 0);
}

/** Reached-but-unclaimed chest indices. */
export function claimableArenaChests(state: ArenaState, tuning: ArenaTuning): number[] {
  return reachedArenaChests(state, tuning).filter((i) => !state.claimedChests.includes(i));
}

export function claimArenaChest(state: ArenaState, index: number): ArenaState {
  if (state.claimedChests.includes(index)) return state;
  return { ...state, claimedChests: [...state.claimedChests, index] };
}

/** Best-rank achievement indices reached (`bestPlace` at or better than `place`). */
export function reachedAchievements(state: ArenaState, tuning: ArenaTuning): number[] {
  if (state.bestPlace <= 0) return [];
  return tuning.bestRankTiers
    .map((tier, i) => (state.bestPlace <= tier.place ? i : -1))
    .filter((i) => i >= 0);
}

export function claimableAchievements(state: ArenaState, tuning: ArenaTuning): number[] {
  return reachedAchievements(state, tuning).filter((i) => !state.claimedAchievements.includes(i));
}

export function claimAchievement(state: ArenaState, index: number): ArenaState {
  if (state.claimedAchievements.includes(index)) return state;
  return { ...state, claimedAchievements: [...state.claimedAchievements, index] };
}

export interface ArenaSettlement {
  reward: Rewards;
  resetCredits: number;
  /** The band the settlement was paid for. */
  bandIndex: number;
}

/** What a player at `credits` is paid (and reset to) at the weekly settlement. */
export function settlementFor(credits: number, bands: readonly ArenaBand[]): ArenaSettlement {
  const bandIndex = arenaBandIndex(credits, bands);
  const band = bands[bandIndex]!;
  return { reward: band.reward, resetCredits: band.resetCredits, bandIndex };
}

/**
 * Apply the weekly settlement when the week key changes: pay the band, reset the
 * credits to the band floor, and clear the day's chest progress. `settlement` is
 * null when the week has not turned, so the caller only writes Mail on a rollover.
 */
export function applyWeeklySettlement(
  state: ArenaState,
  weekKey: string,
  bands: readonly ArenaBand[],
): { state: ArenaState; settlement: ArenaSettlement | null } {
  if (state.weekKey === weekKey) return { state, settlement: null };
  const settlement = settlementFor(state.credits, bands);
  return {
    state: {
      ...state,
      weekKey,
      credits: settlement.resetCredits,
      battleCount: 0,
      claimedChests: [],
      attempts: 0,
      bought: 0,
    },
    settlement,
  };
}
