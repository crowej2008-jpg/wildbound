import {
  arenaBandIndex,
  arenaOpponentSeeds,
  ghostSquad,
  isCleared,
  orderStages,
  rankedMatchSeed,
  weatherFor,
  weatherRule,
  type AccountState,
  type ArenaState,
  type ArenaTuning,
  type EnemyPoolSpec,
  type RankedPhase,
  type RankedState,
  type RankedTuning,
  type StageEnemy,
  type WeatherPick,
  type WeatherRule,
} from '@wildbound/engine';
import type { GameConfig } from '../config';
import { resolveCurve } from '../pve/shared';

/**
 * Shared PvP helpers (M10, PROMPT §7.7): project the content tables to engine
 * tuning, resolve a mode's ghost squads, and decide the chapter gates. See
 * docs/design/pvp.md.
 */

/** The Arena rules the engine reads (`pvp.json`'s `arena` minus the enemy pool). */
export function arenaTuning(config: GameConfig): ArenaTuning {
  const a = config.pvp.arena;
  return {
    freeAttemptsPerDay: a.freeAttemptsPerDay,
    attemptPrices: a.attemptPrices,
    opponentCount: a.opponentCount,
    creditsPerWin: a.creditsPerWin,
    creditsPerLoss: a.creditsPerLoss,
    creditCap: a.creditCap,
    bands: a.bands,
    chestTiers: a.chestTiers,
    bestRankTiers: a.bestRankTiers,
  };
}

/** The Ranked rules the engine reads (`pvp.json`'s `ranked`). */
export function rankedTuning(config: GameConfig): RankedTuning {
  return config.pvp.ranked;
}

/** True once every stage of `chapter` is cleared (the ladder's chapter gate). */
export function chapterCleared(config: GameConfig, state: AccountState, chapter: number): boolean {
  const stages = orderStages(config.stages).filter((s) => s.chapter === chapter);
  const last = stages[stages.length - 1];
  return last !== undefined && isCleared(state.campaign, last.id);
}

export function arenaUnlocked(config: GameConfig, state: AccountState): boolean {
  return chapterCleared(config, state, config.pvp.arenaChapter);
}

export function rankedUnlocked(config: GameConfig, state: AccountState): boolean {
  return chapterCleared(config, state, config.pvp.rankedChapter);
}

/**
 * The three Arena opponents for the caller's current rank: deterministic ghost
 * squads seeded by `(day, credits, reroll)`. The band index shifts the curve and
 * the slot makes the trio a low/mid/high pick, mirroring the reference's "matched
 * with 3 opponents of similar strength for your current rank".
 */
export function arenaOpponentSquads(config: GameConfig, arena: ArenaState): StageEnemy[][] {
  const tuning = arenaTuning(config);
  const seeds = arenaOpponentSeeds(arena.day, arena.credits, arena.opponentSeed, tuning.opponentCount);
  const curve = resolveCurve(config, config.pvp.arena.opponent as EnemyPoolSpec);
  const band = arenaBandIndex(arena.credits, tuning.bands);
  return seeds.map((seed, slot) => ghostSquad(curve, 'arena', seed, slot, band + slot));
}

/** The Arena opponent at one index (or `null` past the trio). */
export function arenaOpponentAt(config: GameConfig, arena: ArenaState, index: number): StageEnemy[] | null {
  const squads = arenaOpponentSquads(config, arena);
  if (!Number.isInteger(index) || index < 0 || index >= squads.length) return null;
  return squads[index] ?? null;
}

/** A stable display name for a ghost place on the Arena ranking board. */
export function arenaGhostName(place: number): string {
  const seed = (place * 2654435761) % 9000;
  return `Trainer ${String(1000 + seed).padStart(4, '0')}`;
}

// --- Ranked ----------------------------------------------------------------

/** The region a Ranked player is currently in (falls back to the first phase). */
export function rankedPhase(config: GameConfig, ranked: RankedState): RankedPhase {
  const phases = config.pvp.ranked.phases;
  return phases[ranked.phase] ?? phases[0]!;
}

/** The season's weather faction for the player's current region. */
export function rankedWeather(config: GameConfig, ranked: RankedState): WeatherPick {
  return weatherFor(rankedPhase(config, ranked).weather, ranked.season);
}

/** The current region's weather as the battle rule the engine reads. */
export function rankedWeatherRule(config: GameConfig, ranked: RankedState): WeatherRule {
  return weatherRule(rankedWeather(config, ranked), config.pvp.ranked.weatherDmg);
}

/**
 * The region's best-of-`bestOf` rival squads: one ghost lineup per game, each
 * `teamSize` wide, seeded by `(season, region, tier)` and scaled by the tier so
 * the same rung always meets the same rivals.
 */
export function rankedOpponentSquads(config: GameConfig, ranked: RankedState): StageEnemy[][] {
  const tuning = rankedTuning(config);
  const phase = rankedPhase(config, ranked);
  const base = resolveCurve(config, config.pvp.ranked.opponent as EnemyPoolSpec);
  const curve = { ...base, count: phase.teamSize };
  const seed = rankedMatchSeed(ranked.season, ranked.phase, ranked.tier);
  return Array.from({ length: tuning.bestOf }, (_, game) => ghostSquad(curve, 'ranked', seed, game, ranked.tier));
}

/** The rival squad for one game of the series (or `null` past the series). */
export function rankedOpponentAt(config: GameConfig, ranked: RankedState, game: number): StageEnemy[] | null {
  const squads = rankedOpponentSquads(config, ranked);
  if (!Number.isInteger(game) || game < 0 || game >= squads.length) return null;
  return squads[game] ?? null;
}
