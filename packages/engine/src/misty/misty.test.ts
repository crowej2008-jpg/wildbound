import { describe, expect, it } from 'vitest';
import {
  arrive,
  floorPay,
  fountain,
  healAll,
  hire,
  initialMisty,
  mistyCycle,
  reachable,
  recordFight,
  revive,
  rollMisty,
  rollTiles,
  stepBlock,
  type MistyRules,
} from './index';

const DAY = 86_400_000;
const NOW = Date.UTC(2026, 10, 5, 12);

const rules: MistyRules = {
  cycleDays: 2,
  chapter4Stage: 'c20-10',
  nodes: [
    { id: 10101, chapter: 1, floor: 1, pos: 1, tiles: ['start'], pre: [0] },
    { id: 10201, chapter: 1, floor: 2, pos: 1, tiles: ['fight'], pre: [10101] },
    { id: 10202, chapter: 1, floor: 2, pos: 2, tiles: ['tombstone', 'fight'], pre: [10101] },
    { id: 11101, chapter: 1, floor: 11, pos: 1, tiles: ['boss'], pre: [10201, 10202] },
    { id: 20101, chapter: 2, floor: 1, pos: 1, tiles: ['start'], pre: [0] },
  ],
  floors: [
    { chapter: 1, floor: 2, rate: 33, forestCoin: 105, gems: 0 },
    { chapter: 1, floor: 11, rate: 60, forestCoin: 150, gems: 10 },
  ],
  fountainHeal: 0.3,
  reviveHp: 0.5,
  shop: { healAll: 50, revive: 100 },
  hireOffers: 3,
  enemy: { factions: [], tiers: [], count: 6, baseLevel: 1, levelSlope: 1, starsEvery: 0, maxStars: 20, stageEvery: 0, maxStage: 3 },
};

describe('Misty Woods rules', () => {
  it('starts on the chapter start, offers only linked tiles, and resets every 2 days', () => {
    const state = initialMisty(rules, NOW);
    expect(state.at).toBe(10101);
    expect(reachable(rules, state).map((n) => n.id).sort()).toEqual([10201, 10202]);
    expect(stepBlock(rules, state, 11101)).toBe('not_reachable');
    expect(rollTiles(rules, state.cycle)).toEqual(state.rolled);
    expect(Object.keys(state.rolled)).toEqual(['10202']);
    const later = rollMisty(rules, { ...state, done: [10201] }, NOW + 2 * DAY);
    expect(later.cycle).toBe(mistyCycle(rules, NOW) + 1);
    expect(later.done).toEqual([]);
  });

  it('carries HP and Rage, drops the knocked out, and pays each floor once', () => {
    let state = initialMisty(rules, NOW);
    state = recordFight(state, [
      { id: 'a', hpFraction: 0.4, rage: 300, alive: true },
      { id: 'b', hpFraction: 0, rage: 0, alive: false },
    ]);
    expect(state.hp).toEqual({ a: 0.4 });
    expect(state.rage).toEqual({ a: 300 });
    expect(state.fallen).toEqual(['b']);
    const node = rules.nodes[1]!;
    const first = floorPay(rules, state, node);
    expect(first.forestCoin).toBe(105);
    expect(floorPay(rules, first.state, node).forestCoin).toBe(0);
  });

  it('heals at fountains and the shop, and revives the fallen', () => {
    let state = recordFight(initialMisty(rules, NOW), [
      { id: 'a', hpFraction: 0.5, rage: 0, alive: true },
      { id: 'b', hpFraction: 0, rage: 0, alive: false },
    ]);
    expect(fountain(rules, state).hp.a).toBeCloseTo(0.8);
    expect(healAll(state).hp.a).toBe(1);
    const back = revive(rules, state, 'b');
    expect(back.ok && back.state.hp.b).toBe(0.5);
    if (back.ok) state = back.state;
    expect(state.fallen).toEqual([]);
    expect(revive(rules, state, 'b').ok).toBe(false);
  });

  it('hires an offered helper and clears the offer', () => {
    const state = { ...initialMisty(rules, NOW), hireOffer: ['mew', 'celebi'] };
    expect(hire(state, 'lugia', 100, 10).ok).toBe(false);
    const out = hire(state, 'mew', 100, 10);
    expect(out.ok && out.state.helpers).toEqual([{ id: 'helper-1', speciesId: 'mew', level: 100, stars: 10 }]);
    expect(out.ok && out.state.hireOffer).toBeNull();
  });

  it('beating the floor-11 boss clears the chapter and moves to the next start', () => {
    const state = { ...initialMisty(rules, NOW), at: 10201, done: [10201] };
    const next = arrive(rules, state, rules.nodes[3]!);
    expect(next.chaptersCleared).toEqual([1]);
    expect(next.chapter).toBe(2);
    expect(next.at).toBe(20101);
  });
});
