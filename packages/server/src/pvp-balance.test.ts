import { describe, expect, it } from 'vitest';
import {
  ghostSquad,
  rankedMatchSeed,
  weatherFor,
  weatherRule,
  type AccountState,
  type Squad,
  type StageEnemy,
} from '@wildbound/engine';
import { buildConfig, type GameConfig } from './config';
import { createInitialState } from './save';
import { resolveCurve } from './pve/shared';
import { enemyStar, modeBattle } from './battle';

/**
 * PvP balance regression (M10.6 — PROMPT §7.7, §13 "statistical tests").
 *
 * The Arena opens at campaign chapter 2 and Ranked at chapter 3, so both modes are
 * first met by the six **starting** (rare) Wilds — the roster `campaign-balance.test.ts`
 * grows to Lv26/3★ to clear chapter 3. The ghost curves are anchored to that scale and
 * climb from it, so the two failure modes this suite guards are:
 *
 *  1. a **wall**: a chapter-graduate squad wins ~0% at the entry rung (the shipped
 *     `baseLevel 60`, full-catalogue pool did this — the pool's supreme/mythic species
 *     carry 2.5-3.2x a rare's stat total, so no amount of early growth answered them); and
 *  2. a **pancake**: the ladder is trivial at every rung, so rank carries no meaning.
 *
 * Numbers are the measured win rates of `docs/design/pvp.md`'s balance section, sampled
 * over a fixed ghost/seed list (5 draws x 3 slots x 6 seeds) so the test is deterministic.
 * Margins are wide enough for unrelated re-tuning but will catch a re-flattened ladder or
 * a re-admitted high tier. Squad profiles are the roster's own six species grown.
 */

const NOW = Date.UTC(2026, 9, 17, 12, 0, 0);
const STARTERS = ['ninetales', 'charizard', 'starmie', 'blastoise', 'venusaur', 'raichu'];
const DRAWS = 5;
const TRIALS = 6;
/** The Arena's eight bands and Ranked's twelve tiers are indexed 0-based. */
const ARENA_TOP_BAND = 7;
const RANKED_TOP_TIER = 11;

function makeConfig(): GameConfig {
  return { ...buildConfig(), now: () => NOW };
}

/** `_stage` is kept for the call sites' readability; since R1 the star alone decides the form. */
function squad(config: GameConfig, level: number, stars: number, _stage: number): AccountState {
  const base = createInitialState(config);
  const roster = base.roster.map((wild, index) => {
    const speciesId = STARTERS[index] ?? wild.speciesId;
    // R1: `stars` here keeps the pre-retrofit meaning (1★ = a fresh copy), like the ghosts' legacy
    // stars (battle.ts enemyStar), so both sides count up from their species' first star.
    const meta = config.species.get(speciesId)!;
    return { ...wild, level, stars: enemyStar(meta, stars), speciesId };
  });
  const ids: Squad = roster.map((wild) => wild.id);
  return { ...base, roster, squads: { ...base.squads, arenaAttack: ids } };
}

/** Win rate over the fixed seed list for one ghost squad. */
function winRate(
  config: GameConfig,
  state: AccountState,
  enemies: StageEnemy[],
  extra: { weather?: ReturnType<typeof weatherRule>; sizeCap?: number } = {},
): number {
  let wins = 0;
  for (let seed = 1; seed <= TRIALS; seed += 1) {
    const view = modeBattle(config, state, {
      squadMode: 'arenaAttack',
      label: 'arenaFight',
      enemies,
      battleId: `balance:${seed}`,
      seed: seed * 7919,
      ...extra,
    });
    if (view?.winner === 'attackers') wins += 1;
  }
  return wins / TRIALS;
}

function arenaRate(config: GameConfig, level: number, stars: number, stage: number, band: number): number {
  const curve = resolveCurve(config, config.pvp.arena.opponent);
  const state = squad(config, level, stars, stage);
  let wins = 0;
  let total = 0;
  for (const slot of [0, 1, 2]) {
    for (let draw = 0; draw < DRAWS; draw += 1) {
      const enemies = ghostSquad(curve, 'arena', 1000 + draw * 77, slot, band + slot);
      wins += winRate(config, state, enemies) * TRIALS;
      total += TRIALS;
    }
  }
  return wins / total;
}

/** Ranked's first region (Kanto: 2x4), with the season's weather applied. */
function rankedRate(config: GameConfig, level: number, stars: number, stage: number, tier: number): number {
  const season = '2026-W42';
  const phase = config.pvp.ranked.phases[0]!;
  const curve = { ...resolveCurve(config, config.pvp.ranked.opponent), count: phase.teamSize };
  const weather = weatherRule(weatherFor(phase.weather, season), config.pvp.ranked.weatherDmg);
  const state = squad(config, level, stars, stage);
  let wins = 0;
  let total = 0;
  for (const game of [0, 1, 2]) {
    const enemies = ghostSquad(curve, 'ranked', rankedMatchSeed(season, 0, tier), game, tier);
    wins += winRate(config, state, enemies, { weather, sizeCap: phase.teamSize }) * TRIALS;
    total += TRIALS;
  }
  return wins / total;
}

describe('PvP balance', () => {
  it('draws Arena and Ranked rivals from the tiers the player can answer', () => {
    const config = makeConfig();
    const tiersOf = (enemies: StageEnemy[]) => enemies.map((e) => config.species.get(e.speciesId)?.tier ?? '');
    const forbidden = new Set(['supreme', 'mythic']);

    const arenaCurve = resolveCurve(config, config.pvp.arena.opponent);
    const seen = new Set<string>();
    for (let draw = 0; draw < 40; draw += 1) {
      for (const slot of [0, 1, 2]) {
        const enemies = ghostSquad(arenaCurve, 'arena', 2000 + draw * 31, slot, draw % 8);
        for (const tier of tiersOf(enemies)) expect(forbidden.has(tier)).toBe(false);
        for (const enemy of enemies) seen.add(enemy.speciesId);
      }
    }
    // The Arena is the entry ladder: a varied field of the campaign's own tier band.
    expect(seen.size).toBeGreaterThanOrEqual(15);
    expect(seen.size).toBeLessThanOrEqual(arenaCurve.pool.length);

    const rankedCurve = resolveCurve(config, config.pvp.ranked.opponent);
    for (let tier = 0; tier <= RANKED_TOP_TIER; tier += 1) {
      for (const game of [0, 1, 2]) {
        const enemies = ghostSquad(rankedCurve, 'ranked', rankedMatchSeed('2026-W42', 0, tier), game, tier);
        for (const unitTier of tiersOf(enemies)) expect(forbidden.has(unitTier)).toBe(false);
      }
    }
  });

  it('gives a chapter-2 graduate a fair entry rung in the Arena, and a ceiling above it', () => {
    const config = makeConfig();
    // The chapter-2 graduate: the starters at Lv20/2 stars (the chapter-3 target is Lv26/3*).
    const entry = arenaRate(config, 20, 2, 1, 0);
    expect(entry).toBeGreaterThanOrEqual(0.25);
    expect(entry).toBeLessThanOrEqual(0.9);

    // Same squad higher up the ladder: rank means something.
    const high = arenaRate(config, 20, 2, 1, 6);
    expect(high).toBeLessThanOrEqual(0.25);
    expect(high).toBeLessThan(entry);

    // One rung of growth stays close; four rungs of growth clearly wins.
    const band2 = arenaRate(config, 26, 3, 1, 2);
    expect(band2).toBeGreaterThanOrEqual(0.25);
    expect(arenaRate(config, 40, 5, 2, 4)).toBeGreaterThanOrEqual(0.55);

    // A maxed squad clears the ladder — the top band is reachable, not a wall.
    expect(arenaRate(config, 140, 10, 2, 0)).toBeGreaterThanOrEqual(0.7);
    expect(arenaRate(config, 140, 10, 2, ARENA_TOP_BAND)).toBeGreaterThanOrEqual(0.7);
  });

  it('gives a chapter-3 graduate a fair entry tier in Ranked and reserves the apex', () => {
    const config = makeConfig();
    const entry = rankedRate(config, 30, 3, 1, 0);
    expect(entry).toBeGreaterThanOrEqual(0.35);
    expect(entry).toBeLessThanOrEqual(0.9);

    // The mid ladder is comfortable for a grown squad.
    expect(rankedRate(config, 60, 6, 2, 5)).toBeGreaterThanOrEqual(0.6);

    // King tier is an apex: a strong-but-not-maxed squad struggles, a maxed one wins.
    const strong = rankedRate(config, 140, 10, 2, RANKED_TOP_TIER);
    expect(strong).toBeLessThanOrEqual(0.6);
    expect(rankedRate(config, 200, 10, 2, RANKED_TOP_TIER)).toBeGreaterThanOrEqual(0.5);
  });
});
