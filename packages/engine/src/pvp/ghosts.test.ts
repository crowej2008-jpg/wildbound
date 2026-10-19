import { describe, expect, it } from 'vitest';
import { arenaOpponentSeed, arenaOpponentSeeds, ghostSeed, ghostSquad, rankedMatchSeed } from './ghosts';
import type { ResolvedCurve } from '../pve/types';

const CURVE: ResolvedCurve = {
  pool: ['a', 'b', 'c', 'd', 'e'],
  count: 3,
  baseLevel: 50,
  levelSlope: 1.05,
  starsEvery: 0,
  maxStars: 1,
  stageEvery: 0,
  maxStage: 0,
};

describe('ghost opponents', () => {
  it('is deterministic for the same (mode, seed, slot)', () => {
    const first = ghostSquad(CURVE, 'arena', 12345, 0);
    const again = ghostSquad(CURVE, 'arena', 12345, 0);
    expect(again).toEqual(first);
    expect(first).toHaveLength(3);
    expect(new Set(first.map((e) => e.speciesId)).size).toBe(3); // drawn without replacement
  });

  it('differs by slot and by mode', () => {
    const slot0 = ghostSquad(CURVE, 'arena', 12345, 0);
    const slot1 = ghostSquad(CURVE, 'arena', 12345, 1);
    const ranked = ghostSquad(CURVE, 'ranked', 12345, 0);
    expect(slot1).not.toEqual(slot0);
    expect(ranked).not.toEqual(slot0);
  });

  it('scales with the index and mixes a distinct seed', () => {
    const low = ghostSquad(CURVE, 'ranked', 777, 0, 0);
    const high = ghostSquad(CURVE, 'ranked', 777, 0, 5);
    expect(high[0]!.level).toBeGreaterThan(low[0]!.level);
    expect(ghostSeed('ranked', 777, 0)).not.toBe(ghostSeed('arena', 777, 0));
  });

  it('derives stable per-day opponent seeds', () => {
    const seeds = arenaOpponentSeeds('2026-01-07', 450, 0, 3);
    expect(seeds).toHaveLength(3);
    expect(seeds).toEqual(arenaOpponentSeeds('2026-01-07', 450, 0, 3));
    expect(new Set(seeds).size).toBe(3);
    // A different rank or day (or a reroll) changes the trio.
    expect(arenaOpponentSeeds('2026-01-07', 450, 0, 3)).not.toEqual(arenaOpponentSeeds('2026-01-07', 451, 0, 3));
    expect(arenaOpponentSeeds('2026-01-07', 450, 1, 3)).not.toEqual(seeds);
    expect(arenaOpponentSeed('2026-01-07', 450, 0)).not.toBe(arenaOpponentSeed('2026-01-08', 450, 0));
  });

  it('returns an empty squad for an empty pool', () => {
    expect(ghostSquad({ ...CURVE, pool: [] }, 'arena', 1, 0)).toEqual([]);
  });

  it('seeds a Ranked match from the season, region and tier', () => {
    const seed = rankedMatchSeed('2026-W02', 0, 3);
    expect(rankedMatchSeed('2026-W02', 0, 3)).toBe(seed);
    // A different season, region or rung meets different rivals.
    expect(rankedMatchSeed('2026-W03', 0, 3)).not.toBe(seed);
    expect(rankedMatchSeed('2026-W02', 1, 3)).not.toBe(seed);
    expect(rankedMatchSeed('2026-W02', 0, 4)).not.toBe(seed);
    // The same rung always fields the same squad across repeated matches.
    expect(ghostSquad(CURVE, 'ranked', seed, 0, 3)).toEqual(ghostSquad(CURVE, 'ranked', seed, 0, 3));
  });
});
