import {
  danId,
  inDailyPause,
  rankedAttemptPrice,
  seasonClosedAt,
  tierProgress,
  type Faction,
  type Rewards,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { fielded, powerOf } from './battle';
import { rankedPhase, rankedTuning, rankedUnlocked, rankedWeather } from './pvp';
import { rolledRanked } from './pvp/ranked';
import type { AccountState } from '@wildbound/engine';

/**
 * Display-ready Ranked view (M10.3). Pure reads of `AccountState` + `GameConfig`;
 * the client renders it without contacting the engine. See docs/design/pvp.md.
 */

export interface RankedTierView {
  index: number;
  name: string;
  /** Score floor of this tier. */
  score: number;
  /** Region coins paid on claim. */
  coin: number;
  reached: boolean;
  claimed: boolean;
  current: boolean;
}

export interface RankedGiftView {
  index: number;
  matches: number;
  reward: Rewards;
  reached: boolean;
  claimed: boolean;
}

export interface RankedView {
  unlocked: boolean;
  /** Campaign chapter that opens the ladder (content). */
  chapter: number;
  phaseIndex: number;
  phaseCount: number;
  phaseName: string;
  /** The region's squad format: `teams` lineups of `teamSize`. */
  teams: number;
  teamSize: number;
  /** The reference's dan id for the current rung. */
  dan: number;
  tierIndex: number;
  tierCount: number;
  tierName: string;
  score: number;
  floor: number;
  nextScore: number | null;
  /** True when the next win is the promotion match. */
  atThreshold: boolean;
  weatherCurrent: Faction;
  weatherNext: Faction;
  weatherDmg: number;
  attempts: number;
  attemptsTotal: number;
  attemptsPerDay: number;
  attemptPrice: number;
  canChallenge: boolean;
  matches: number;
  wins: number;
  losses: number;
  winRate: number;
  streak: number;
  bestStreak: number;
  dayWins: number;
  dayBattles: number;
  /** True during the 03:00–05:00 UTC daily update window. */
  paused: boolean;
  seasonEndsMs: number;
  tiers: RankedTierView[];
  gifts: RankedGiftView[];
  /** The lineup the ladder fields, trimmed to the region's team size. */
  squad: { count: number; power: number };
}

export function buildRankedView(config: GameConfig, state: AccountState, now: number): RankedView {
  const tuning = rankedTuning(config);
  const ranked = rolledRanked(config, state, now);
  const phase = rankedPhase(config, ranked);
  const progress = tierProgress(ranked, tuning);
  const weather = rankedWeather(config, ranked);

  const claimedTiers = new Set(ranked.claimedTiers);
  const claimedGifts = new Set(ranked.claimedGifts);
  const lineup = fielded(state, 'arenaAttack').slice(0, phase.teamSize);

  return {
    unlocked: rankedUnlocked(config, state),
    chapter: config.pvp.rankedChapter,
    phaseIndex: ranked.phase,
    phaseCount: tuning.phases.length,
    phaseName: phase.name,
    teams: phase.teams,
    teamSize: phase.teamSize,
    dan: danId(ranked.phase, ranked.tier),
    tierIndex: ranked.tier,
    tierCount: tuning.tiers.length,
    tierName: tuning.tiers[ranked.tier]?.name ?? '',
    score: ranked.score,
    floor: progress.floor,
    nextScore: progress.nextScore,
    atThreshold: progress.nextScore !== null && ranked.score >= progress.nextScore,
    weatherCurrent: weather.current,
    weatherNext: weather.next,
    weatherDmg: tuning.weatherDmg,
    attempts: ranked.attempts,
    attemptsTotal: tuning.freeAttemptsPerDay + ranked.bought,
    attemptsPerDay: tuning.freeAttemptsPerDay,
    attemptPrice: rankedAttemptPrice(ranked, tuning),
    canChallenge: ranked.attempts < tuning.freeAttemptsPerDay + ranked.bought,
    matches: ranked.matches,
    wins: ranked.wins,
    losses: ranked.losses,
    winRate: ranked.wins + ranked.losses > 0 ? ranked.wins / (ranked.wins + ranked.losses) : 0,
    streak: ranked.streak,
    bestStreak: ranked.bestStreak,
    dayWins: ranked.dayWins,
    dayBattles: ranked.dayBattles,
    paused: inDailyPause(now),
    seasonEndsMs: Math.max(0, seasonClosedAt(now) - now),
    tiers: tuning.tiers.map((tier, index) => ({
      index,
      name: tier.name,
      score: tier.score,
      coin: phase.coins[index] ?? 0,
      reached: index <= ranked.tier,
      claimed: claimedTiers.has(index),
      current: index === ranked.tier,
    })),
    gifts: tuning.giftTrack.map((gift, index) => ({
      index,
      matches: gift.matches,
      reward: gift.reward,
      reached: ranked.matches >= gift.matches,
      claimed: claimedGifts.has(index),
    })),
    squad: {
      count: lineup.length,
      power: lineup.reduce((sum, wild) => sum + powerOf(wild, config, state), 0),
    },
  };
}
