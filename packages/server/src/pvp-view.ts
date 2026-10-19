import {
  arenaAttemptPrice,
  arenaBandIndex,
  arenaRank,
  dayKey,
  msUntilNextUtcMidnight,
  nextWeekStart,
  reachedAchievements,
  reachedArenaChests,
  rollArenaDay,
  type AccountState,
  type Rewards,
} from '@wildbound/engine';
import type { GameConfig } from './config';
import { buildEnemyTeam, powerOf } from './battle';
import { arenaGhostName, arenaOpponentSquads, arenaTuning, arenaUnlocked } from './pvp';

/**
 * Display-ready PvP views (M10). Pure reads of `AccountState` + `GameConfig`; the
 * client renders them without contacting the engine. See docs/design/pvp.md.
 */

export interface ArenaOpponentView {
  index: number;
  level: number;
  count: number;
  power: number;
  /** Display names of the ghost squad's species, front row first. */
  names: string[];
}

export interface ArenaChestView {
  index: number;
  battles: number;
  reward: Rewards;
  reached: boolean;
  claimed: boolean;
}

export interface ArenaAchievementView {
  index: number;
  place: number;
  reward: Rewards;
  reached: boolean;
  claimed: boolean;
}

export interface ArenaView {
  unlocked: boolean;
  /** Campaign chapter that opens the Arena (content). */
  chapter: number;
  credits: number;
  bestCredits: number;
  place: number;
  /** Best (lowest) place ever reached; 0 = never ranked. */
  bestPlace: number;
  bandIndex: number;
  bandCount: number;
  attempts: number;
  attemptsTotal: number;
  attemptsPerDay: number;
  attemptPrice: number;
  battleCount: number;
  canChallenge: boolean;
  opponents: ArenaOpponentView[];
  chests: ArenaChestView[];
  achievements: ArenaAchievementView[];
  defence: { count: number; power: number };
  dayResetMs: number;
  weekResetMs: number;
}

export function buildArenaView(config: GameConfig, state: AccountState, now: number): ArenaView {
  const tuning = arenaTuning(config);
  const arena = rollArenaDay(state.pvp.arena, dayKey(now));
  const squads = arenaOpponentSquads(config, arena);
  const opponents = squads.map((enemies, index) => {
    const team = buildEnemyTeam(enemies, config);
    return {
      index,
      level: enemies.reduce((max, e) => Math.max(max, e.level), 0),
      count: enemies.length,
      power: team.power,
      names: enemies.map((e) => config.species.get(e.speciesId)?.name ?? e.speciesId),
    };
  });

  const byId = new Map(state.roster.map((w) => [w.id, w]));
  const defenceIds = state.squads.arenaDefence.filter((id): id is string => typeof id === 'string');
  const defenceWilds = defenceIds.map((id) => byId.get(id)).filter((w): w is NonNullable<typeof w> => w !== undefined);

  const reached = new Set(reachedArenaChests(arena, tuning));
  const claimedChests = new Set(arena.claimedChests);
  const reachedAch = new Set(reachedAchievements(arena, tuning));
  const claimedAch = new Set(arena.claimedAchievements);

  return {
    unlocked: arenaUnlocked(config, state),
    chapter: config.pvp.arenaChapter,
    credits: arena.credits,
    bestCredits: arena.bestCredits,
    place: arenaRank(arena.credits, tuning.bands),
    bestPlace: arena.bestPlace,
    bandIndex: arenaBandIndex(arena.credits, tuning.bands),
    bandCount: tuning.bands.length,
    attempts: arena.attempts,
    attemptsTotal: tuning.freeAttemptsPerDay + arena.bought,
    attemptsPerDay: tuning.freeAttemptsPerDay,
    attemptPrice: arenaAttemptPrice(arena, tuning),
    battleCount: arena.battleCount,
    canChallenge: arena.attempts < tuning.freeAttemptsPerDay + arena.bought,
    opponents,
    chests: tuning.chestTiers.map((tier, index) => ({
      index,
      battles: tier.battles,
      reward: tier.reward,
      reached: reached.has(index),
      claimed: claimedChests.has(index),
    })),
    achievements: tuning.bestRankTiers.map((tier, index) => ({
      index,
      place: tier.place,
      reward: tier.reward,
      reached: reachedAch.has(index),
      claimed: claimedAch.has(index),
    })),
    defence: {
      count: defenceWilds.length,
      power: defenceWilds.reduce((sum, w) => sum + powerOf(w, config, state), 0),
    },
    dayResetMs: msUntilNextUtcMidnight(now),
    weekResetMs: nextWeekStart(now) - now,
  };
}

export interface ArenaBandView {
  index: number;
  minCredits: number;
  /** The place this band's credit floor represents. */
  place: number;
  reward: Rewards;
  current: boolean;
}

export interface ArenaRankingEntryView {
  place: number;
  name: string;
  you: boolean;
  /** Credits only for the player's own row; ghost places carry none. */
  credits: number | null;
}

export interface ArenaRankingsView {
  unlocked: boolean;
  place: number;
  credits: number;
  bestPlace: number;
  bandIndex: number;
  bandCount: number;
  bands: ArenaBandView[];
  /** The player's row plus deterministic ghost places above and below. */
  entries: ArenaRankingEntryView[];
  weekResetMs: number;
}

/** How many ghost rows to show on each side of the player's place. */
const RANKING_WINDOW = 4;

export function buildArenaRankingsView(config: GameConfig, state: AccountState, now: number): ArenaRankingsView {
  const tuning = arenaTuning(config);
  const arena = rollArenaDay(state.pvp.arena, dayKey(now));
  const place = arenaRank(arena.credits, tuning.bands);
  const bandIndex = arenaBandIndex(arena.credits, tuning.bands);

  const entries: ArenaRankingEntryView[] = [{ place, name: state.profile.name, you: true, credits: arena.credits }];
  for (let offset = -RANKING_WINDOW; offset <= RANKING_WINDOW; offset += 1) {
    if (offset === 0) continue;
    const ghostPlace = place + offset;
    if (ghostPlace < 1) continue;
    entries.push({ place: ghostPlace, name: arenaGhostName(ghostPlace), you: false, credits: null });
  }
  entries.sort((a, b) => a.place - b.place);

  return {
    unlocked: arenaUnlocked(config, state),
    place,
    credits: arena.credits,
    bestPlace: arena.bestPlace,
    bandIndex,
    bandCount: tuning.bands.length,
    bands: tuning.bands.map((band, index) => ({
      index,
      minCredits: band.minCredits,
      place: band.startPlace,
      reward: band.reward,
      current: index === bandIndex,
    })),
    entries,
    weekResetMs: nextWeekStart(now) - now,
  };
}
