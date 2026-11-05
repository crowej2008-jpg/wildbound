import { describe, expect, it } from 'vitest';
import {
  clearFactionFloor,
  climbBlock,
  factionFloorBonus,
  factionFloorPay,
  initialFactionTower,
  lineupBlock,
  rollFactionTower,
  spendFactionSweep,
  sweepPrice,
  teamsFor,
  type FactionTowerRules,
} from './index';

const RULES: FactionTowerRules = {
  floors: 1000,
  floorsPerDay: 20,
  twoTeamFrom: 701,
  minOfType: 4,
  allies: ['light', 'dark'],
  openDays: { water: [1, 4, 0], fire: [2, 5, 0], grass: [3, 6, 0] },
  freeSweeps: 2,
  sweepPrices: [10, 20],
  pay: {
    gold: { base: 30000, step: 500, every: 5, max: 84500 },
    starShard: { base: 150, step: 25, every: 5, max: 2875 },
    factionCoin: { base: 330, step: 10, every: 10, max: 870 },
  },
  bonus: { every: 5, atFloor: 910, factionCoin: 10650, starShard: 29750 },
};

describe('Faction Tower rules', () => {
  it('pays the wiki table per floor, capped around floor 550', () => {
    const rows: [number, number, number, number][] = [
      [1, 30000, 150, 330],
      [50, 34500, 375, 370],
      [100, 39500, 625, 420],
      [250, 54500, 1375, 570],
      [280, 57500, 1525, 600],
      [550, 84500, 2875, 870],
      [1000, 84500, 2875, 870],
    ];
    for (const [floor, gold, starShard, factionCoin] of rows) expect(factionFloorPay(RULES, floor)).toEqual({ gold, starShard, factionCoin });
  });

  it('adds the one-time bonus on every fifth floor, at the wiki figure on floor 910', () => {
    expect(factionFloorBonus(RULES, 4)).toEqual({});
    expect(factionFloorBonus(RULES, 910)).toEqual({ factionCoin: 10650, starShard: 29750 });
    expect(factionFloorBonus(RULES, 5).factionCoin).toBeGreaterThan(0);
  });

  it('opens each tower on its weekdays, all on Sunday, 20 floors a day, two teams from 701', () => {
    const s = initialFactionTower('2026-11-02');
    expect(climbBlock(RULES, s, 'water', 1)).toBeNull();
    expect(climbBlock(RULES, s, 'fire', 1)).toBe('closed');
    for (const f of ['water', 'fire', 'grass'] as const) expect(climbBlock(RULES, s, f, 0)).toBeNull();
    let t = s;
    for (let i = 0; i < 20; i += 1) t = clearFactionFloor(t, 'water');
    expect(t.floors.water).toBe(20);
    expect(climbBlock(RULES, t, 'water', 1)).toBe('daily_limit');
    const rolled = rollFactionTower(t, '2026-11-03');
    expect(rolled.climbed.water).toBe(0);
    expect(rolled.floors.water).toBe(20);
    expect(teamsFor(RULES, 700)).toBe(1);
    expect(teamsFor(RULES, 701)).toBe(2);
    expect(climbBlock(RULES, { ...s, floors: { ...s.floors, grass: 1000 } }, 'grass', 0)).toBe('top');
  });

  it('admits the tower faction plus Light and Dark, at least 4 of its own', () => {
    expect(lineupBlock(RULES, 'water', ['water', 'water', 'water', 'water', 'light', 'dark'])).toBeNull();
    expect(lineupBlock(RULES, 'water', ['water', 'water', 'water', 'light', 'dark', 'dark'])).toBe('min_type');
    expect(lineupBlock(RULES, 'water', ['water', 'water', 'water', 'water', 'fire'])).toBe('faction');
  });

  it('gives two free sweeps, then sells two for 10 and 20 Diamonds', () => {
    let s = initialFactionTower('2026-11-02');
    const prices: (number | null)[] = [];
    for (let i = 0; i < 5; i += 1) {
      const p = sweepPrice(RULES, s);
      prices.push(p);
      if (p !== null) s = spendFactionSweep(RULES, s);
    }
    expect(prices).toEqual([0, 0, 10, 20, null]);
  });
});
