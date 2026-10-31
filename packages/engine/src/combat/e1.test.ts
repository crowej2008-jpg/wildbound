import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { evalCondition } from './conditions';
import { landControl } from './control';
import { blockChanceAt, computeDamage } from './damage';
import { kit, makeCtx, sheet, skill, spec, unit } from './fixtures';
import { addRage } from './rage';
import { takeTurn } from './skills';
import { effective } from './stats';
import { resolveHealWithBasis } from './sustain';
import { fireTriggers } from './triggers';
import type { TriggerDef } from './types';

/** E1: the new battle triggers, conditions, stats and damage modifiers. */

const team = { attackersPower: 100, defendersPower: 100 };

describe('E1 stats and conditions', () => {
  it('rageBlock stops Rage gains but not losses', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1, rage: 500 });
    const ctx = makeCtx({ units: [a], deterministic: true });
    a.buffs.push({ tag: 'shell', kind: 'rageBlock', source: 'x', bigRounds: 1 });
    addRage(ctx, a, 250);
    expect(a.rage).toBe(500);
    addRage(ctx, a, -100);
    expect(a.rage).toBe(400);
  });

  it('atkPct raises P.ATK and S.ATK by a share', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet({ pAtk: 1000, sAtk: 500 }) });
    a.buffs.push({ tag: 'vest', kind: 'stat', source: 'x', field: 'atkPct', amount: 0.1 });
    expect(effective(a.base, a.buffs, 'pAtk')).toBeCloseTo(1100);
    expect(effective(a.base, a.buffs, 'sAtk')).toBeCloseTo(550);
  });

  it('round windows: from / until / even', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const ctx = makeCtx({ units: [a], deterministic: true });
    ctx.round = 2;
    expect(evalCondition({ round: { even: true } }, ctx, a)).toBe(true);
    expect(evalCondition({ round: { until: 1 } }, ctx, a)).toBe(false);
    expect(evalCondition({ round: { from: 3 } }, ctx, a)).toBe(false);
    ctx.round = 3;
    expect(evalCondition({ round: { from: 3, even: false } }, ctx, a)).toBe(true);
  });

  it('targetHasAnyTag matches a burn or a poison', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const d = unit({ key: 'd', side: 'defenders', position: 4 });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    expect(evalCondition({ targetHasAnyTag: ['burning', 'flame'] }, ctx, a, d)).toBe(false);
    d.buffs.push({ tag: 'flame', kind: 'dot', source: 'a' });
    expect(evalCondition({ targetHasAnyTag: ['burning', 'flame'] }, ctx, a, d)).toBe(true);
  });
});

describe('E1 damage modifiers', () => {
  it('adds a matching dmg mod into the G pair (Wide Lens: +10% against the backline)', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 4, sheet: sheet({ pAtk: 1000 }) });
    const front = unit({ key: 'f', side: 'defenders', position: 4 });
    const back = unit({ key: 'b', side: 'defenders', position: 1 });
    const ctx = makeCtx({ units: [atk, front, back], deterministic: true });
    const s = skill({ slot: 'normal' });
    const plain = computeDamage({ attacker: atk, defender: back, skill: s, hitIndex: 0, team }, ctx).dmg;
    atk.damageMods = [{ tag: 'wide', condition: { targetRow: 'back' }, dmg: 0.1 }];
    expect(computeDamage({ attacker: atk, defender: back, skill: s, hitIndex: 0, team }, ctx).dmg).toBe(Math.floor(plain * 1.1));
    expect(computeDamage({ attacker: atk, defender: front, skill: s, hitIndex: 0, team }, ctx).dmg).toBe(plain);
  });

  it('an atk mod raises the attack a hit reads, a slot narrows it', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 4, sheet: sheet({ pAtk: 1000 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4 });
    const ctx = makeCtx({ units: [atk, d], deterministic: true });
    const normal = skill({ slot: 'normal' });
    const plain = computeDamage({ attacker: atk, defender: d, skill: normal, hitIndex: 0, team }, ctx).dmg;
    atk.damageMods = [{ tag: 'rock', slot: 'ult', atk: 0.5 }];
    expect(computeDamage({ attacker: atk, defender: d, skill: normal, hitIndex: 0, team }, ctx).dmg).toBe(plain);
    atk.damageMods = [{ tag: 'rock', atk: 0.5 }];
    expect(computeDamage({ attacker: atk, defender: d, skill: normal, hitIndex: 0, team }, ctx).dmg).toBe(Math.floor(plain * 1.5));
  });

  it('ignoreBlock shrinks the Block the hit sees (Choice Band 50%, Sticky Barb 100%)', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 4 });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ block: 1 }) });
    const points: [number, number][] = [
      [0, 0],
      [1, 0.5],
    ];
    expect(blockChanceAt(atk, d, points)).toBeCloseTo(0.5);
    expect(blockChanceAt(atk, d, points, 0.5)).toBeCloseTo(0.25);
    expect(blockChanceAt(atk, d, points, 1)).toBeCloseTo(0);
  });
});

describe('E1 triggers', () => {
  function withTriggers(triggers: TriggerDef[], over: Parameters<typeof unit>[0]) {
    const u = unit(over);
    u.triggers = triggers;
    return u;
  }

  it('gear triggers fire after the kit, and maxFires caps a battle', () => {
    const a = withTriggers([{ on: 'onHit', maxFires: 1, rage: 100 }], { key: 'a', side: 'attackers', position: 1, rage: 0 });
    const ctx = makeCtx({ units: [a], deterministic: true });
    fireTriggers(ctx, a, 'onHit');
    ctx.round = 2;
    fireTriggers(ctx, a, 'onHit');
    expect(a.rage).toBe(100);
  });

  it('`event` targets the unit the event is about', () => {
    const a = withTriggers(
      [{ on: 'onCrit', effects: [{ op: 'buff', target: { event: true }, buff: { tag: 'easy', kind: 'stat', field: 'critRes', amount: -0.1, maxStacks: 3, bigRounds: 2 } }] }],
      { key: 'a', side: 'attackers', position: 1 },
    );
    const d = unit({ key: 'd', side: 'defenders', position: 4 });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    fireTriggers(ctx, a, 'onCrit', { target: d });
    fireTriggers(ctx, a, 'onCrit', { target: d });
    expect(effective(d.base, d.buffs, 'critRes')).toBeCloseTo(-0.2);
    expect(a.buffs).toHaveLength(0);
  });

  it('a landed control fires onControlled on the target and onInflictControl on the caster', () => {
    const caster = withTriggers([{ on: 'onInflictControl', rage: 50 }], { key: 'c', side: 'attackers', position: 1, rage: 0 });
    const t = withTriggers([{ on: 'onControlled', rage: 70 }], { key: 't', side: 'defenders', position: 4, rage: 0 });
    const ctx = makeCtx({ units: [caster, t], deterministic: true });
    landControl(ctx, caster, t, 'stun');
    expect(caster.rage).toBe(50);
    expect(t.rage).toBe(70);
  });

  it('afterUlt fires once the ultimate resolves', () => {
    const a = withTriggers([{ on: 'afterUlt', buff: { tag: 'leftovers', kind: 'stat', field: 'basicRate', amount: 0.5, turns: 3 } }], {
      key: 'a',
      side: 'attackers',
      position: 4,
      rage: 1000,
    });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1e9 }) });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    takeTurn(ctx, a, { bigRound: 1, team });
    expect(ctx.events.some((e) => e.type === 'action' && e.skill === 'ult')).toBe(true);
    // applied during the action; the battle loop ticks turns after the action
    expect(a.buffs.find((b) => b.tag === 'leftovers')?.turns).toBe(3);
  });

  it('heals read the caster S.ATK or current HP', () => {
    const c = unit({ key: 'c', side: 'attackers', position: 1, sheet: sheet({ hp: 1000, sAtk: 400 }), hp: 600 });
    const t = unit({ key: 't', side: 'attackers', position: 2, sheet: sheet({ hp: 5000 }) });
    const ctx = makeCtx({ units: [c, t], deterministic: true });
    expect(resolveHealWithBasis(ctx, c, t, 0.35, 'casterSAtk')).toBe(140);
    expect(resolveHealWithBasis(ctx, c, t, 0.05, 'casterCurrentHp')).toBe(30);
  });
});

describe('E1 in a full battle', () => {
  it('a turn-start backline heal (Light Clay) heals the hurt backline', () => {
    const lightClay: TriggerDef = {
      on: 'turnStart',
      effects: [{ op: 'heal', target: { side: 'ally', rule: 'all', rowFilter: 'back' }, rate: 0.05, basis: 'casterCurrentHp' }],
    };
    const attackers = [
      { ...spec({ id: 'tank', side: 'attackers', position: 4, sheet: sheet({ hp: 200000, pAtk: 10 }) }), triggers: [lightClay] },
      spec({ id: 'back', side: 'attackers', position: 1, sheet: sheet({ hp: 50000, pAtk: 10 }) }),
    ];
    const defenders = [spec({ id: 'foe', side: 'defenders', position: 1, kit: kit({ skills: { normal: { rule: 'backline' } } }), sheet: sheet({ hp: 1e7, pAtk: 2000 }) })];
    const result = runBattle({ attackers, defenders, seed: 3 });
    const backKey = 'attackers:1';
    expect(result.events.some((e) => e.type === 'heal' && e.tgt === backKey)).toBe(true);
  });
});
