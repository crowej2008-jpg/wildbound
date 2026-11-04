import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import { resolveSummonCost, summonCounts } from './cost';
import {
  activeWish,
  boxReady,
  drawBatch,
  giftReady,
  groupTable,
  openGift,
  probabilityTable,
  rowWeight,
  wellUnlocked,
} from './gacha';
import { initialGacha, type GachaMachineDef, type GachaRow, type SupremeGiftDef, type WishingWellDef } from './types';

/** R9: summoning copied from the source (docs/design/gacha.md). */

const premium: GachaMachineDef = {
  id: 'premium',
  ticket: 'ticketPremium',
  gemPerDraw: 180,
  gemPerTen: 1620,
  freePerDay: 1,
  freeCooldownMinutes: 1440,
  creditPerDraw: 1,
  vipCreditPerDraw: 20,
  boxCreditsNeeded: 20,
  boxRewards: { preciousShard: 5 },
  maxTenBatches: 5,
};
const common: GachaMachineDef = { ...premium, id: 'common', ticket: 'ticketCommon', gemPerDraw: null, gemPerTen: null, maxTenBatches: 1 };

const rows: GachaRow[] = [
  { speciesId: 'caterpie', star: 1, weight: 900_000, group: 'other', faction: 'grass', tier: 'common' },
  { speciesId: 'entei', star: 5, weight: 50_000, group: 'legendary', faction: 'fire', tier: 'legendary' },
  { speciesId: 'suicune', star: 5, weight: 50_000, group: 'legendary', faction: 'water', tier: 'legendary' },
];
const well: WishingWellDef = { machine: 'premium', unlockDraws: 200, factions: ['water', 'fire', 'grass'], tier: 'legendary', boost: 1.8 };
const gift: SupremeGiftDef = { credits: 1000, vipLevel: 14, species: ['lugia', 'ho-oh', 'dialga'] };

describe('summon price (the source client’s pick)', () => {
  it('single: free, then a ticket, then gems; Common has no gem price', () => {
    expect(resolveSummonCost(premium, 1, { ticketPremium: 3, gems: 999 }, 1)).toEqual({ ok: true, cost: { free: 1, tickets: 0, gems: 0 } });
    expect(resolveSummonCost(premium, 1, { ticketPremium: 3, gems: 999 }, 0)).toEqual({ ok: true, cost: { free: 0, tickets: 1, gems: 0 } });
    expect(resolveSummonCost(premium, 1, { gems: 180 }, 0)).toEqual({ ok: true, cost: { free: 0, tickets: 0, gems: 180 } });
    expect(resolveSummonCost(common, 1, { gems: 9999 }, 0)).toEqual({ ok: false, reason: 'insufficient_items' });
  });

  it('ten: ten tickets, else 1,620 gems; free draws are never used', () => {
    expect(resolveSummonCost(premium, 10, { ticketPremium: 10 }, 1)).toEqual({ ok: true, cost: { free: 0, tickets: 10, gems: 0 } });
    expect(resolveSummonCost(premium, 10, { ticketPremium: 9, gems: 1620 }, 1)).toEqual({ ok: true, cost: { free: 0, tickets: 0, gems: 1620 } });
  });

  it('the Premium plus multi-draw goes to 5 × 10 on tickets only', () => {
    expect(summonCounts(premium)).toEqual([1, 10, 20, 30, 40, 50]);
    expect(summonCounts(common)).toEqual([1, 10]);
    expect(resolveSummonCost(premium, 50, { ticketPremium: 50 }, 0)).toEqual({ ok: true, cost: { free: 0, tickets: 50, gems: 0 } });
    expect(resolveSummonCost(premium, 20, { ticketPremium: 19, gems: 1e6 }, 0)).toEqual({ ok: false, reason: 'insufficient_items' });
    expect(resolveSummonCost(common, 20, { ticketCommon: 50 }, 0)).toEqual({ ok: false, reason: 'invalid_input' });
    expect(resolveSummonCost(premium, 5, { ticketPremium: 50 }, 0)).toEqual({ ok: false, reason: 'invalid_input' });
  });
});

describe('draws', () => {
  it('pick pool rows by their weight, with their star, and are reproducible from a seed', () => {
    const a = drawBatch(mulberry32(7), rows, null, 2000);
    const b = drawBatch(mulberry32(7), rows, null, 2000);
    expect(a).toEqual(b);
    const legendary = a.filter((d) => d.group === 'legendary').length / a.length;
    expect(legendary).toBeGreaterThan(0.07);
    expect(legendary).toBeLessThan(0.13);
    expect(a.find((d) => d.speciesId === 'entei')?.star).toBe(5);
  });

  it('the rates sheet is each row’s share of the pool, grouped rarest first', () => {
    const table = probabilityTable(rows, null);
    expect(table.map((r) => r.probability)).toEqual([0.9, 0.05, 0.05]);
    expect(groupTable(table)).toEqual([
      { group: 'legendary', probability: 0.1 },
      { group: 'other', probability: 0.9 },
    ]);
  });
});

describe('Wishing Well', () => {
  it('opens after 200 Premium draws and only on Premium', () => {
    const state = initialGacha([premium, common], '2026-11-02').machines.premium;
    expect(wellUnlocked(well, state)).toBe(false);
    expect(activeWish(well, premium, state, 'fire')).toBeNull();
    const ready = { ...state, lifetimeDraws: 200 };
    expect(activeWish(well, premium, ready, 'fire')).toEqual({ faction: 'fire', tier: 'legendary', boost: 1.8 });
    expect(activeWish(well, common, ready, 'fire')).toBeNull();
    expect(activeWish(well, premium, ready, 'light')).toBeNull();
    expect(activeWish(well, premium, ready, null)).toBeNull();
  });

  it('raises the chosen faction’s Legendaries by 80 % and nothing else', () => {
    const wish = { faction: 'fire' as const, tier: 'legendary' as const, boost: 1.8 };
    expect(rows.map((r) => rowWeight(r, wish))).toEqual([900_000, 90_000, 50_000]);
  });
});

describe('credit box and Supreme Gift', () => {
  it('a box is ready at its credits', () => {
    const state = { freeRemaining: 0, nextFreeAt: 0, boxCredits: 19, lifetimeDraws: 19 };
    expect(boxReady(state, premium)).toBe(false);
    expect(boxReady({ ...state, boxCredits: 20 }, premium)).toBe(true);
  });

  it('the Supreme Gift needs 1,000 VIP credits and VIP 14, and picks at equal weight', () => {
    expect(giftReady(gift, 1000, 13)).toBe(false);
    expect(giftReady(gift, 999, 14)).toBe(false);
    expect(giftReady(gift, 1000, 14)).toBe(true);
    const rng = mulberry32(3);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 3000; i++) {
      const id = openGift(rng, gift);
      counts[id] = (counts[id] ?? 0) + 1;
    }
    for (const id of gift.species) expect(counts[id]).toBeGreaterThan(900);
  });
});
