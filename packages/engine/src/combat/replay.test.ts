import { describe, expect, it } from 'vitest';
import { initReplay, lastActor, lastTarget, replayTo, stepReplay, type ReplayUnit } from './replay';
import type { BattleEvent } from './types';

const units = (): ReplayUnit[] => [
  {
    key: 'attackers:4',
    side: 'attackers',
    position: 4,
    hp: 1000,
    maxHp: 1000,
    shield: 0,
    rage: 500,
    alive: true,
    buffs: [],
  },
  {
    key: 'defenders:1',
    side: 'defenders',
    position: 1,
    hp: 800,
    maxHp: 800,
    shield: 0,
    rage: 500,
    alive: true,
    buffs: [],
  },
];

function hp(state: ReturnType<typeof initReplay>, key: string): number | undefined {
  return state.units.find((u) => u.key === key)?.hp;
}

describe('replay reducer', () => {
  it('seeds a fresh state and clones the unit list', () => {
    const seed = units();
    const state = initReplay(seed);
    expect(state).toEqual({ round: 0, winner: null, units: seed });
    expect(state.units).not.toBe(seed);
    expect(state.units[0]?.buffs).not.toBe(seed[0]?.buffs);
  });

  it('tracks rounds and the result', () => {
    const start: BattleEvent = { type: 'roundStart', bigRound: 3 };
    const end: BattleEvent = { type: 'result', winner: 'defenders', rounds: 3 };
    let state = initReplay(units());
    state = stepReplay(state, start);
    expect(state.round).toBe(3);
    state = stepReplay(state, end);
    expect(state.winner).toBe('defenders');
  });

  it('applies damage and kills a unit on a hit', () => {
    let state = initReplay(units());
    state = stepReplay(state, {
      type: 'hit',
      src: 'attackers:4',
      tgt: 'defenders:1',
      dmg: 300,
      crit: false,
      blocked: false,
      hpAfter: 500,
    });
    expect(hp(state, 'defenders:1')).toBe(500);
    expect(state.units.find((u) => u.key === 'defenders:1')?.alive).toBe(true);

    state = stepReplay(state, {
      type: 'hit',
      src: 'attackers:4',
      tgt: 'defenders:1',
      dmg: 500,
      crit: true,
      blocked: false,
      hpAfter: 0,
    });
    const target = state.units.find((u) => u.key === 'defenders:1');
    expect(target?.hp).toBe(0);
    expect(target?.alive).toBe(false);
  });

  it('heals, shields and changes rage', () => {
    let state = initReplay(units());
    state = stepReplay(state, { type: 'heal', tgt: 'defenders:1', amount: 120, hpAfter: 920 });
    expect(hp(state, 'defenders:1')).toBe(920);
    state = stepReplay(state, { type: 'shield', tgt: 'defenders:1', amount: 200, shieldAfter: 200 });
    expect(state.units.find((u) => u.key === 'defenders:1')?.shield).toBe(200);
    state = stepReplay(state, { type: 'rageChange', unit: 'attackers:4', delta: 125, rage: 625 });
    expect(state.units.find((u) => u.key === 'attackers:4')?.rage).toBe(625);
  });

  it('marks a death event', () => {
    let state = initReplay(units());
    state = stepReplay(state, { type: 'death', unit: 'defenders:1' });
    const target = state.units.find((u) => u.key === 'defenders:1');
    expect(target?.hp).toBe(0);
    expect(target?.alive).toBe(false);
  });

  it('maintains the buff tag set', () => {
    let state = initReplay(units());
    state = stepReplay(state, { type: 'buffApplied', unit: 'attackers:4', tag: 'atkUp', amount: 0.2 });
    state = stepReplay(state, { type: 'buffApplied', unit: 'attackers:4', tag: 'atkUp', amount: 0.2 });
    state = stepReplay(state, { type: 'immunity', unit: 'attackers:4', kind: 'stun' });
    expect(state.units.find((u) => u.key === 'attackers:4')?.buffs).toEqual(['atkUp', 'immune']);
    state = stepReplay(state, { type: 'buffExpired', unit: 'attackers:4', tag: 'atkUp' });
    expect(state.units.find((u) => u.key === 'attackers:4')?.buffs).toEqual(['immune']);
  });

  it('does not mutate the previous state (immutability)', () => {
    const before = initReplay(units());
    const after = stepReplay(before, {
      type: 'hit',
      src: 'attackers:4',
      tgt: 'defenders:1',
      dmg: 100,
      crit: false,
      blocked: false,
      hpAfter: 700,
    });
    expect(before.units.find((u) => u.key === 'defenders:1')?.hp).toBe(800);
    expect(after.units.find((u) => u.key === 'defenders:1')?.hp).toBe(700);
  });

  it('replays a prefix deterministically (same log, same frames)', () => {
    const events: BattleEvent[] = [
      { type: 'roundStart', bigRound: 1 },
      { type: 'hit', src: 'attackers:4', tgt: 'defenders:1', dmg: 250, crit: false, blocked: false, hpAfter: 550 },
      { type: 'rageChange', unit: 'defenders:1', delta: 125, rage: 625 },
      { type: 'heal', tgt: 'defenders:1', amount: 50, hpAfter: 600 },
    ];
    const a = replayTo(units(), events, 4);
    const b = replayTo(units(), events, 4);
    expect(a).toEqual(b);
    expect(hp(a, 'defenders:1')).toBe(600);
    expect(a.units.find((u) => u.key === 'defenders:1')?.rage).toBe(625);
    // A shorter prefix stops earlier and never sees the future.
    const early = replayTo(units(), events, 2);
    expect(hp(early, 'defenders:1')).toBe(550);
    expect(early.units.find((u) => u.key === 'defenders:1')?.rage).toBe(500);
  });

  it('finds the actor and target of an event', () => {
    const events: BattleEvent[] = [
      { type: 'roundStart', bigRound: 1 },
      { type: 'hit', src: 'attackers:4', tgt: 'defenders:1', dmg: 10, crit: false, blocked: false, hpAfter: 790 },
    ];
    expect(lastActor(events, 1)).toBe('attackers:4');
    expect(lastTarget(events, 1)).toBe('defenders:1');
    expect(lastActor(events, 0)).toBeNull();
    expect(lastTarget(events, 99)).toBeNull();
  });
});
