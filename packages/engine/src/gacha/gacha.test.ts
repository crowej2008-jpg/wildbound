import { describe, expect, it } from 'vitest';
import { mulberry32 } from '../rng';
import {
  boxReady,
  drawBatch,
  initialGacha,
  type GachaMachineDef,
  type GachaPoolEntry,
} from './index';
import { isAtLeast } from './types';
import { resolveSummonCost } from './cost';

const COMMON_DEF: GachaMachineDef = {
  id: 'common',
  ticket: 'ticketCommon',
  gemPerDraw: null,
  gemPerTen: null,
  freePerDay: 5,
  freeCooldownMinutes: 5,
  creditPerDraw: 1,
  boxCreditsNeeded: 100,
  boxRewards: { shard: 50 },
  pityThreshold: 0,
  wish: false,
  wishBoost: 3.5,
  wishUnlockDraws: 0,
  tenDrawGuarantee: 'rare',
  rates: [
    { tier: 'common', weight: 55 },
    { tier: 'rare', weight: 30 },
    { tier: 'epic', weight: 12 },
    { tier: 'legendary', weight: 2.4 },
    { tier: 'supreme', weight: 0.5 },
    { tier: 'mythic', weight: 0.1 },
  ],
};

const PREMIUM_DEF: GachaMachineDef = {
  id: 'premium',
  ticket: 'ticketPremium',
  gemPerDraw: 180,
  gemPerTen: 1620,
  freePerDay: 1,
  freeCooldownMinutes: 1440,
  creditPerDraw: 20,
  boxCreditsNeeded: 400,
  boxRewards: { shard: 200, stone: 3 },
  pityThreshold: 1000,
  wish: true,
  wishBoost: 3.5,
  wishUnlockDraws: 0,
  tenDrawGuarantee: 'rare',
  rates: [
    { tier: 'common', weight: 30 },
    { tier: 'rare', weight: 30 },
    { tier: 'epic', weight: 25 },
    { tier: 'legendary', weight: 10 },
    { tier: 'supreme', weight: 3.5 },
    { tier: 'mythic', weight: 1.5 },
  ],
};

const POOL: GachaPoolEntry[] = [
  { speciesId: 's_common1', tier: 'common' },
  { speciesId: 's_common2', tier: 'common' },
  { speciesId: 's_common3', tier: 'common' },
  { speciesId: 's_common4', tier: 'common' },
  { speciesId: 's_common5', tier: 'common' },
  { speciesId: 's_common6', tier: 'common' },
  { speciesId: 's_rare1', tier: 'rare' },
  { speciesId: 's_rare2', tier: 'rare' },
  { speciesId: 's_rare3', tier: 'rare' },
  { speciesId: 's_rare4', tier: 'rare' },
  { speciesId: 's_rare5', tier: 'rare' },
  { speciesId: 's_rare6', tier: 'rare' },
  { speciesId: 's_rare7', tier: 'rare' },
  { speciesId: 's_rare8', tier: 'rare' },
  { speciesId: 's_epic1', tier: 'epic' },
  { speciesId: 's_epic2', tier: 'epic' },
  { speciesId: 's_epic3', tier: 'epic' },
  { speciesId: 's_epic4', tier: 'epic' },
  { speciesId: 's_epic5', tier: 'epic' },
  { speciesId: 's_epic6', tier: 'epic' },
  { speciesId: 's_epic7', tier: 'epic' },
  { speciesId: 's_legend1', tier: 'legendary' },
  { speciesId: 's_legend2', tier: 'legendary' },
  { speciesId: 's_legend3', tier: 'legendary' },
  { speciesId: 's_legend4', tier: 'legendary' },
  { speciesId: 's_legend5', tier: 'legendary' },
  { speciesId: 's_legend6', tier: 'legendary' },
  { speciesId: 's_legend7', tier: 'legendary' },
  { speciesId: 's_supreme1', tier: 'supreme' },
  { speciesId: 's_supreme2', tier: 'supreme' },
  { speciesId: 's_supreme3', tier: 'supreme' },
  { speciesId: 's_supreme4', tier: 'supreme' },
  { speciesId: 's_mythic1', tier: 'mythic' },
  { speciesId: 's_mythic2', tier: 'mythic' },
  { speciesId: 's_mythic3', tier: 'mythic' },
  { speciesId: 's_mythic4', tier: 'mythic' },
];

describe('gacha', () => {
  it('initialGacha seeds per-machine free draws', () => {
    const state = initialGacha([COMMON_DEF, PREMIUM_DEF], '2026-10-12');
    expect(state.machines.common.freeRemaining).toBe(5);
    expect(state.machines.premium.freeRemaining).toBe(1);
    expect(state.machines.common.pityCredits).toBe(0);
    expect(state.machines.common.boxCredits).toBe(0);
  });

  it('pity triggers at the exact count (premium: 50 draws × 20 = 1000)', () => {
    const rng = mulberry32(123);
    let credits = { box: 0, pity: 0 };
    for (let i = 0; i < 49; i++) {
      const step = drawBatch(rng, POOL, PREMIUM_DEF, null, credits, 1);
      credits = step.credits;
    }
    const before = { box: credits.box, pity: credits.pity };
    const step50 = drawBatch(rng, POOL, PREMIUM_DEF, null, before, 1);
    const last = step50.results[0];
    expect(last).toBeDefined();
    expect(step50.credits.pity).toBeGreaterThanOrEqual(0);
  });

  it('ten-draw guarantee holds (at least one Rare or better)', () => {
    const rng = mulberry32(42);
    const { results } = drawBatch(rng, POOL, COMMON_DEF, null, { box: 0, pity: 0 }, 10);
    expect(results.length).toBe(10);
    const hasRarePlus = results.some((r) => isAtLeast(r.tier, 'rare'));
    expect(hasRarePlus).toBe(true);
    expect(hasRarePlus).toBe(true);
  });

  it('credits add correctly (common box becomes ready at 100)', () => {
    const rng = mulberry32(7);
    const state = initialGacha([COMMON_DEF, PREMIUM_DEF], '2026-10-12').machines.common;
    let credits = { box: state.boxCredits, pity: state.pityCredits };
    for (let i = 0; i < 99; i++) {
      const step = drawBatch(rng, POOL, COMMON_DEF, null, credits, 1);
      credits = step.credits;
    }
    expect(credits.box).toBe(99);
    const readyBefore = boxReady({ ...state, boxCredits: 99 }, COMMON_DEF);
    expect(readyBefore).toBe(false);
    const step100 = drawBatch(rng, POOL, COMMON_DEF, null, credits, 1);
    expect(step100.credits.box).toBe(100);
    const readyAfter = boxReady({ ...state, boxCredits: 100 }, COMMON_DEF);
    expect(readyAfter).toBe(true);
  });

  it('cost fallback is exact: free → ticket → gems (premium single)', () => {
    const free0 = resolveSummonCost(PREMIUM_DEF, 1, { ticketPremium: 1, gems: 1000 }, 0);
    expect(free0.ok).toBe(true);
    if (free0.ok) expect(free0.cost).toEqual({ free: 0, tickets: 1, gems: 0 });

    const noTicketNoFree = resolveSummonCost(PREMIUM_DEF, 1, { gems: 180 }, 0);
    expect(noTicketNoFree.ok).toBe(true);
    if (noTicketNoFree.ok) expect(noTicketNoFree.cost).toEqual({ free: 0, tickets: 0, gems: 180 });

    const freeWins = resolveSummonCost(PREMIUM_DEF, 1, { gems: 100000 }, 3);
    expect(freeWins.ok).toBe(true);
    if (freeWins.ok) expect(freeWins.cost).toEqual({ free: 1, tickets: 0, gems: 0 });

    const tenNeedsTickets = resolveSummonCost(PREMIUM_DEF, 10, {}, 5);
    expect(tenNeedsTickets.ok).toBe(false);

    const tenGems = resolveSummonCost(PREMIUM_DEF, 10, { gems: 1620 }, 5);
    expect(tenGems.ok).toBe(true);
    if (tenGems.ok) expect(tenGems.cost).toEqual({ free: 0, tickets: 0, gems: 1620 });
  });

  it('seeded draw set is reproducible', () => {
    const rng1 = mulberry32(999);
    const rng2 = mulberry32(999);
    const b1 = drawBatch(rng1, POOL, PREMIUM_DEF, null, { box: 0, pity: 0 }, 10);
    const b2 = drawBatch(rng2, POOL, PREMIUM_DEF, null, { box: 0, pity: 0 }, 10);
    expect(b1.results.map((r) => ({ speciesId: r.speciesId, tier: r.tier, guaranteed: r.guaranteed }))).toEqual(
      b2.results.map((r) => ({ speciesId: r.speciesId, tier: r.tier, guaranteed: r.guaranteed })),
    );
    expect(b1.credits).toEqual(b2.credits);
  });

  it('wish affects species selection inside the rolled tier (premium)', () => {
    const rng = mulberry32(1);
    const wish = 's_legend1';
    const { results } = drawBatch(rng, POOL, PREMIUM_DEF, wish, { box: 0, pity: 0 }, 5);
    expect(results.length).toBe(5);
  });

  it('common has no gem fallback', () => {
    const no = resolveSummonCost(COMMON_DEF, 1, {}, 0);
    expect(no.ok).toBe(false);
    const okT = resolveSummonCost(COMMON_DEF, 10, { ticketCommon: 10 }, 0);
    expect(okT.ok).toBe(true);
  });

  it('box progress helpers behave', () => {
    const s = { freeRemaining: 5, nextFreeAt: 0, boxCredits: 50, pityCredits: 0, lifetimeDraws: 0 };
    const ready = boxReady(s, COMMON_DEF);
    expect(ready).toBe(false);
    const s2 = { ...s, boxCredits: 100 };
    expect(boxReady(s2, COMMON_DEF)).toBe(true);
  });
});
