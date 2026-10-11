import { describe, expect, it } from 'vitest';
import { candyCost, canEvolve, evolveCheck, levelCapOf, levelUpCost, starUpCost } from './costs';
import type { ProgressTables, WildInstance } from './types';

const tables: ProgressTables = {
  levelUp: { candyBase: 48, candyExponent: 1.2, goldPerCandy: 3 },
  starUp: { shardsPerStar: 10, goldPerStar: 200 },
  evolve: [
    { minLevel: 1, minStars: 1, candy: 0, gold: 0, stones: 0 },
    { minLevel: 20, minStars: 1, candy: 300, gold: 900, stones: 1 },
    { minLevel: 40, minStars: 3, candy: 900, gold: 2700, stones: 3 },
  ],
  respawn: { gemCost: 20, refundRate: 0.8 },
  maxLevelByStage: [60, 80, 100, 140],
  maxStars: 10,
};

function instance(over: Partial<WildInstance> = {}): WildInstance {
  return { id: 'w1', speciesId: 'twigleaf', level: 1, stars: 1, evolutionStage: 0, locked: false, acquiredAt: 0, ...over };
}

describe('costs', () => {
  it('candyCost rises with level and is 48 at level 1', () => {
    expect(candyCost(1, tables)).toBe(48);
    expect(candyCost(10, tables)).toBeGreaterThan(candyCost(9, tables));
  });

  it('levelUpCost sums candy and charges 3x gold', () => {
    const cost = levelUpCost(1, 3, tables);
    expect(cost.candy).toBe(candyCost(1, tables) + candyCost(2, tables));
    expect(cost.gold).toBe(cost.candy * 3);
  });

  it('levelCapOf follows the evolution stage', () => {
    expect(levelCapOf(instance({ evolutionStage: 0 }), tables)).toBe(60);
    expect(levelCapOf(instance({ evolutionStage: 2 }), tables)).toBe(100);
  });

  it('starUpCost scales with the current star', () => {
    expect(starUpCost(1, tables)).toEqual({ shards: 10, gold: 200 });
    expect(starUpCost(3, tables)).toEqual({ shards: 30, gold: 600 });
  });

  it('evolveCheck reports the next step and blocks at the last stage', () => {
    const check = evolveCheck(instance(), 3, tables);
    expect('reason' in check).toBe(false);
    if ('reason' in check) throw new Error('expected step');
    expect(check.targetStage).toBe(1);
    expect(check.minLevel).toBe(20);
    expect(evolveCheck(instance({ evolutionStage: 2 }), 3, tables)).toEqual({ reason: 'max_stage' });
  });

  it('canEvolve requires min level and stars', () => {
    expect(canEvolve(instance({ level: 19, stars: 1 }), 3, tables)).toBe(false);
    expect(canEvolve(instance({ level: 20, stars: 1 }), 3, tables)).toBe(true);
    // stage 2 needs 3 stars
    expect(canEvolve(instance({ evolutionStage: 1, level: 40, stars: 2 }), 3, tables)).toBe(false);
    expect(canEvolve(instance({ evolutionStage: 1, level: 40, stars: 3 }), 3, tables)).toBe(true);
  });
});
