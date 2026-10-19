import {
  buyRankedAttempt,
  canChallengeRanked,
  claimGift,
  claimTier,
  claimableGifts,
  claimableTiers,
  rankedAttemptPrice,
  rankedDayKey,
  recordRankedMatch,
  rollRankedDay,
  rollRankedSeason,
  seasonKey,
  type AccountState,
  type RankedState,
  type Rewards,
} from '@wildbound/engine';
import { modeBattle, type BattleView } from '../battle';
import { applyGrant } from '../economy';
import { fail, ok, type Result } from '../index';
import type { GameConfig } from '../config';
import { rankedOpponentSquads, rankedPhase, rankedTuning, rankedUnlocked, rankedWeatherRule } from './shared';

/**
 * Ranked actions (M10.3, PROMPT §7.7): a best-of-`bestOf` series against the
 * region's ghost lineups, the tier ladder with the threshold stop and the
 * promotion match, the daily attempts and the tier / challenge-gift claims.
 * Pure `AccountState` transitions; the LocalServer commits them.
 * See docs/design/pvp.md.
 */

/** How many games take a series: a majority of `bestOf`. */
export function seriesWinsNeeded(bestOf: number): number {
  return Math.max(1, Math.ceil(bestOf / 2));
}

export interface RankedMatchOutcome {
  state: AccountState;
  /** The games played, in order (a 2-0 sweep is two games). */
  battles: BattleView[];
  /** True when the player took the series. */
  won: boolean;
  wins: number;
  losses: number;
  scoreBefore: number;
  scoreAfter: number;
  tierBefore: number;
  tierAfter: number;
  promoted: boolean;
  attemptsLeft: number;
  /** Season match count after this match (drives the challenge-gift track). */
  matches: number;
}

/** The ladder state for `now`: the 03:00 UTC day roll and the seasonal region. */
export function rolledRanked(config: GameConfig, state: AccountState, now: number): RankedState {
  const tuning = rankedTuning(config);
  const day = rollRankedDay(state.pvp.ranked, rankedDayKey(now));
  return rollRankedSeason(day, seasonKey(now), tuning.phases.length);
}

/**
 * Play a Ranked series: up to `bestOf` games against the region's rival lineups,
 * trimmed to the region's team size, with the season's weather. The series ends
 * as soon as either side has a majority; one series costs one attempt and counts
 * as one match on the season's gift track.
 */
export function startRankedMatch(
  config: GameConfig,
  state: AccountState,
  now: number,
  seed?: number,
): Result<RankedMatchOutcome> {
  if (!rankedUnlocked(config, state)) return fail('stage_locked', 'clear the Ranked chapter to unlock the ladder');
  const tuning = rankedTuning(config);
  const ranked = rolledRanked(config, state, now);
  if (!canChallengeRanked(ranked, tuning)) return fail('daily_limit', 'no Ranked attempts left today');

  const phase = rankedPhase(config, ranked);
  const squads = rankedOpponentSquads(config, ranked);
  const weather = rankedWeatherRule(config, ranked);
  const need = seriesWinsNeeded(tuning.bestOf);

  const battles: BattleView[] = [];
  let wins = 0;
  let losses = 0;
  for (let game = 0; game < tuning.bestOf && wins < need && losses < need; game += 1) {
    const enemies = squads[game];
    if (!enemies) break;
    const battle = modeBattle(config, state, {
      squadMode: 'arenaAttack',
      label: 'rankedMatch',
      enemies,
      battleId: `m10:ranked:${ranked.season}:${ranked.phase}:${ranked.tier}:${game}`,
      seed: seed === undefined ? undefined : (seed + game) >>> 0,
      weather,
      sizeCap: phase.teamSize,
    });
    if (!battle) break;
    if (battle.winner === 'attackers') wins += 1;
    else losses += 1;
    battles.push(battle);
  }
  if (battles.length === 0) return fail('not_found', 'no Wilds available for a Ranked match');

  const won = wins > losses;
  const recorded = recordRankedMatch(ranked, won, tuning);
  const next: AccountState = { ...state, pvp: { ...state.pvp, ranked: recorded } };
  return ok({
    state: next,
    battles,
    won,
    wins,
    losses,
    scoreBefore: ranked.score,
    scoreAfter: recorded.score,
    tierBefore: ranked.tier,
    tierAfter: recorded.tier,
    promoted: recorded.tier !== ranked.tier,
    attemptsLeft: Math.max(0, tuning.freeAttemptsPerDay + recorded.bought - recorded.attempts),
    matches: recorded.matches,
  });
}

/** Spend gems for `count` extra Ranked attempts at the day's prices. */
export function buyRankedAttempts(
  config: GameConfig,
  state: AccountState,
  now: number,
  count: number,
): Result<{ state: AccountState; bought: number; spent: number }> {
  const tuning = rankedTuning(config);
  if (!Number.isInteger(count) || count <= 0) return fail('invalid_input', 'count must be a positive integer');
  let ranked = rolledRanked(config, state, now);
  let spent = 0;
  for (let i = 0; i < count; i += 1) {
    spent += rankedAttemptPrice(ranked, tuning);
    ranked = buyRankedAttempt(ranked);
  }
  if (state.currencies.gems < spent) return fail('insufficient_items', 'not enough gems to buy attempts');
  const next: AccountState = {
    ...state,
    currencies: { ...state.currencies, gems: state.currencies.gems - spent },
    pvp: { ...state.pvp, ranked },
  };
  return ok({ state: next, bought: ranked.bought, spent });
}

/** Claim one reached tier's region coins (one-time per season). */
export function claimRankedTier(
  config: GameConfig,
  state: AccountState,
  now: number,
  index: number,
): Result<{ state: AccountState; granted: Rewards }> {
  const tuning = rankedTuning(config);
  const ranked = rolledRanked(config, state, now);
  if (!Number.isInteger(index) || index < 0 || index >= tuning.tiers.length) {
    return fail('invalid_input', `no Ranked tier at index ${index}`);
  }
  if (!claimableTiers(ranked).includes(index)) return fail('not_ready', 'tier not reached or already claimed');
  const granted: Rewards = { arenaToken: rankedPhase(config, ranked).coins[index] ?? 0 };
  const next = applyGrant(
    config,
    { ...state, pvp: { ...state.pvp, ranked: claimTier(ranked, index) } },
    granted,
  );
  return ok({ state: next, granted });
}

/** Claim one reached challenge-gift step (one-time per season). */
export function claimRankedGift(
  config: GameConfig,
  state: AccountState,
  now: number,
  index: number,
): Result<{ state: AccountState; granted: Rewards }> {
  const tuning = rankedTuning(config);
  const ranked = rolledRanked(config, state, now);
  if (!Number.isInteger(index) || index < 0 || index >= tuning.giftTrack.length) {
    return fail('invalid_input', `no Ranked gift at index ${index}`);
  }
  if (!claimableGifts(ranked, tuning).includes(index)) {
    return fail('not_ready', 'gift not reached or already claimed');
  }
  const granted = tuning.giftTrack[index]!.reward;
  const next = applyGrant(
    config,
    { ...state, pvp: { ...state.pvp, ranked: claimGift(ranked, index) } },
    granted,
  );
  return ok({ state: next, granted });
}
