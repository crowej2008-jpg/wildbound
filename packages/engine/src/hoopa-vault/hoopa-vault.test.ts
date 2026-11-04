import { describe, expect, it } from 'vitest';
import {
  drawOffer,
  exitRun,
  floorBand,
  floorOpen,
  initialHoopaVault,
  maxMultiplier,
  routeRoundCap,
  settleGuardian,
  settleRoute,
  startRun,
  type HoopaVaultRules,
} from './index';

const rules: HoopaVaultRules = {
  floors: 300,
  freeKeysPerDay: 5,
  multipliers: [
    { afterFloor: 0, max: 1 },
    { afterFloor: 31, max: 3 },
    { afterFloor: 71, max: 5 },
  ],
  run: {
    startEscape: 10,
    target: 40,
    offerSize: 2,
    cards: {
      strong: { escape: 10, enemyMult: 1.5, attackBoost: 0, dropBoost: 0, weight: 3 },
      normal: { escape: 5, enemyMult: 1, attackBoost: 0, dropBoost: 0, weight: 4 },
      buff: { escape: 5, enemyMult: 1, attackBoost: 0.1, dropBoost: 0, weight: 2 },
      blessing: { escape: 5, enemyMult: 1, attackBoost: 0, dropBoost: 0.25, weight: 2 },
    },
  },
  guardian: { rounds: 15, mult: { hp: 3, atk: 1.5, def: 1.5 } },
  enemy: { factions: [], tiers: [], count: 6, baseLevel: 3, levelSlope: 1.016, starsEvery: 15, maxStars: 20, stageEvery: 30, maxStage: 3 },
  stagePay: { heldItemShard: { base: 2, perFloor: 0.1 }, resetterShard: { chance: 1, min: 1, max: 3 } },
  guardianPay: { resetterShard: { min: 1, max: 4 }, heldItemShard: 10, items: 3 },
  routeDrops: { itemChance: 1, orbChance: 1 },
  resetterFactor: [
    { floor: 1, factor: 1 },
    { floor: 251, factor: 3.5 },
  ],
  bands: [
    { floor: 1, dropPool: 101, note: 'Start dropping Rare quality held items', qualities: { rare: 100 }, orb: null },
    {
      floor: 181,
      dropPool: 115,
      note: 'Start dropping Mythical quality held items',
      qualities: { supreme: 70, mythic: 30 },
      orb: { colour: 'orange', level: 4 },
    },
  ],
};

const NAMES = { rare: ['r1', 'r2'], supreme: ['s1'], mythic: ['m1', 'm2', 'm3'] };

describe("Hoopa's Vault rules", () => {
  it('opens floors one at a time and raises the multiplier past floors 31 and 71', () => {
    expect(floorOpen(rules, 0, 1)).toBe(true);
    expect(floorOpen(rules, 0, 2)).toBe(false);
    expect(floorOpen(rules, 299, 300)).toBe(true);
    expect(floorOpen(rules, 300, 301)).toBe(false);
    expect(maxMultiplier(rules, 30)).toBe(1);
    expect(maxMultiplier(rules, 31)).toBe(3);
    expect(maxMultiplier(rules, 71)).toBe(5);
  });

  it('starts a run with two different cards and refuses a second run or a locked multiplier', () => {
    const started = startRun(rules, initialHoopaVault(), 1, 1, 42);
    expect(started.ok).toBe(true);
    if (!started.ok) return;
    const run = started.state.run!;
    expect(run.escape).toBe(10);
    expect(run.offer).toHaveLength(2);
    expect(new Set(run.offer).size).toBe(2);
    expect(drawOffer(rules, run)).toEqual(run.offer);
    expect(routeRoundCap(run)).toBe(10);
    expect(startRun(rules, started.state, 1, 1, 1).ok).toBe(false);
    expect(startRun(rules, initialHoopaVault(), 1, 3, 1).ok).toBe(false);
  });

  it('banks escape and drops on a win, lets Hoopa advance by rounds, and reaches the Guardian at 40', () => {
    let state = (startRun(rules, initialHoopaVault(), 1, 1, 7) as { ok: true; state: ReturnType<typeof initialHoopaVault> }).state;
    let guard = 0;
    while (!state.run!.atGuardian && guard < 20) {
      const card = state.run!.offer[0]!;
      const out = settleRoute(rules, state, card, true, 1);
      expect(out.ok).toBe(true);
      if (!out.ok) return;
      expect(out.ended).toBeNull();
      expect(out.drops.rewards.heldItemShard).toBeGreaterThan(0);
      state = out.state;
      guard += 1;
    }
    expect(state.run!.escape).toBeGreaterThanOrEqual(40);
    expect(state.run!.offer).toEqual([]);
    expect(state.run!.bag.heldItemShard).toBeGreaterThan(0);
    const won = settleGuardian(rules, state, true);
    expect(won.ok).toBe(true);
    if (!won.ok) return;
    expect(won.state.highest).toBe(1);
    expect(won.state.run).toBeNull();
    expect(won.kept.rewards.resetterShard).toBeGreaterThan(0);
  });

  it('ends the run when Hoopa catches up or a route is lost, and on exit', () => {
    const state = (startRun(rules, initialHoopaVault(), 1, 1, 9) as { ok: true; state: ReturnType<typeof initialHoopaVault> }).state;
    const card = state.run!.offer[0]!;
    const caught = settleRoute(rules, state, card, true, 999);
    expect(caught.ok && caught.ended).toBe('caught');
    const lost = settleRoute(rules, state, card, false, 3);
    expect(lost.ok && lost.ended).toBe('lost');
    const left = exitRun(state);
    expect(left.ok && left.state.run).toBeNull();
    const notOffered = (['strong', 'normal', 'buff', 'blessing'] as const).find((c) => !state.run!.offer.includes(c))!;
    expect(settleRoute(rules, state, notOffered, true, 1).ok).toBe(false);
    expect(settleGuardian(rules, state, true).ok).toBe(false);
  });

  it('multiplies the pay by the multiplier and finds the source band', () => {
    const s1 = (startRun(rules, { ...initialHoopaVault(), highest: 80 }, 81, 1, 5) as { ok: true; state: ReturnType<typeof initialHoopaVault> }).state;
    const s5 = (startRun(rules, { ...initialHoopaVault(), highest: 80 }, 81, 5, 5) as { ok: true; state: ReturnType<typeof initialHoopaVault> }).state;
    const card = s1.run!.offer[0]!;
    const one = settleRoute(rules, s1, card, true, 1);
    const five = settleRoute(rules, s5, card, true, 1);
    if (!one.ok || !five.ok) throw new Error('settle failed');
    expect(five.drops.rewards.heldItemShard).toBe((one.drops.rewards.heldItemShard ?? 0) * 5);
    expect(floorBand(rules, 200)?.dropPool).toBe(115);
    expect(floorBand(rules, 3)?.dropPool).toBe(101);
  });

  it('banks held items by the band odds and orbs from floor bands, kept with 3 Guardian items on a win', () => {
    let state = (startRun(rules, { ...initialHoopaVault(), highest: 199 }, 200, 1, 3) as { ok: true; state: ReturnType<typeof initialHoopaVault> }).state;
    const out = settleRoute(rules, state, state.run!.offer[0]!, true, 1, NAMES);
    if (!out.ok) throw new Error('settle failed');
    expect(out.drops.items).toHaveLength(1);
    expect(['supreme', 'mythic']).toContain(out.drops.items[0]!.quality);
    expect([...NAMES.supreme, ...NAMES.mythic]).toContain(out.drops.items[0]!.defId);
    expect(out.drops.orbs).toEqual([{ colour: 'orange', level: 4 }]);
    state = { ...out.state, run: { ...out.state.run!, atGuardian: true, offer: [] } };
    const won = settleGuardian(rules, state, true, NAMES);
    if (!won.ok) throw new Error('guardian failed');
    expect(won.kept.items).toHaveLength(1 + 3);
    expect(won.kept.orbs).toHaveLength(1);
    const lost = settleGuardian(rules, state, false, NAMES);
    expect(lost.ok && lost.kept.items).toEqual([]);
  });

  it('floor 1 drops only Rare items and no orbs', () => {
    const state = (startRun(rules, initialHoopaVault(), 1, 1, 8) as { ok: true; state: ReturnType<typeof initialHoopaVault> }).state;
    const out = settleRoute(rules, state, state.run!.offer[0]!, true, 1, NAMES);
    if (!out.ok) throw new Error('settle failed');
    expect(out.drops.items.every((i) => i.quality === 'rare')).toBe(true);
    expect(out.drops.orbs).toEqual([]);
  });
});
