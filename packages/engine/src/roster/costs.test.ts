import { describe, expect, it } from 'vitest';
import type { StarCard } from '../growth/types';
import { candyCost, levelUpCost, planFodder, type FodderCandidate } from './costs';
import type { ProgressTables, WildInstance } from './types';

const tables: ProgressTables = {
  levelUp: { candyBase: 48, candyExponent: 1.2, goldPerCandy: 3 },
  respawn: { gemCost: 20, refundRate: 0.8 },
};

function wild(id: string, over: Partial<WildInstance> = {}): WildInstance {
  return { id, speciesId: 'metagross', level: 1, stars: 5, locked: false, acquiredAt: 0, ...over };
}

/** Beldum 7★ → 8★ (source): one own 5★, four grass 5★, two grass 6★. */
const card: StarCard = {
  star: 7,
  name: 'Metang',
  maxLevel: 180,
  basic: { hp: 1, atk: 1, spd: 1 },
  growth: { hp: 1, atk: 1, pDef: 1, sDef: 1 },
  fodder: [
    { own: true, star: 5, count: 1 },
    { own: false, star: 5, faction: 'grass', count: 4 },
    { own: false, star: 6, faction: 'grass', count: 2 },
  ],
};

describe('costs', () => {
  it('candyCost rises with level and is 48 at level 1 (the one known source point)', () => {
    expect(candyCost(1, tables)).toBe(48);
    expect(candyCost(10, tables)).toBeGreaterThan(candyCost(9, tables));
  });

  it('levelUpCost sums candy and charges 3x gold', () => {
    const cost = levelUpCost(1, 3, tables);
    expect(cost.candy).toBe(candyCost(1, tables) + candyCost(2, tables));
    expect(cost.gold).toBe(cost.candy * 3);
  });
});

describe('planFodder (source evolution)', () => {
  const target = wild('t', { stars: 7 });
  const grass = (id: string, stars: number, over: Partial<WildInstance> = {}): FodderCandidate => ({
    instance: wild(id, { speciesId: `other-${id}`, stars, ...over }),
    faction: 'grass',
  });

  it('fills every line with the lowest-level eligible Wilds', () => {
    const candidates: FodderCandidate[] = [
      { instance: target, faction: 'grass' },
      { instance: wild('own5', { stars: 5 }), faction: 'grass' },
      grass('g1', 5, { level: 9 }),
      grass('g2', 5, { level: 1 }),
      grass('g3', 5),
      grass('g4', 5),
      grass('g5', 5, { level: 50 }),
      grass('s1', 6),
      grass('s2', 6),
    ];
    const plan = planFodder(target, card, candidates, new Set());
    expect(plan.missing).toEqual([]);
    expect(plan.consume[0]).toBe('own5');
    expect(plan.consume).toHaveLength(7);
    expect(plan.consume).not.toContain('g5');
    expect(plan.consume).not.toContain('t');
  });

  it('never takes protected, locked, wrong-star or wrong-faction Wilds and reports what is missing', () => {
    const candidates: FodderCandidate[] = [
      { instance: target, faction: 'grass' },
      { instance: wild('own5', { stars: 5 }), faction: 'grass' },
      grass('g1', 5, { locked: true }),
      grass('g2', 5),
      { instance: wild('fire5', { speciesId: 'x', stars: 5 }), faction: 'fire' },
      grass('g6', 6),
    ];
    const plan = planFodder(target, card, candidates, new Set(['g2']));
    expect(plan.consume).toEqual(['own5', 'g6']);
    expect(plan.missing).toEqual([
      { own: false, star: 5, faction: 'grass', count: 4 },
      { own: false, star: 6, faction: 'grass', count: 1 },
    ]);
  });
});
