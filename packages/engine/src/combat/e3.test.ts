import { describe, expect, it } from 'vitest';
import { evalCondition } from './conditions';
import { applyControl, landControl } from './control';
import { channelHit, computeDamage } from './damage';
import { applyDotTag, tickDots } from './dot';
import { applyEffectList } from './effects';
import { kit, makeCtx, sheet, skill, unit } from './fixtures';
import { addRage } from './rage';
import { extraAction, takeTurn } from './skills';
import { selectFor } from './targeting';
import { fireTriggers } from './triggers';

/** E3: the engine pieces the hand-ported kits use. */

const team = { attackersPower: 100, defendersPower: 100 };

describe('E3 conditions and targeting', () => {
  it('round.every counts from `from` (Deoxys: turns 3, 7, 11…)', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const ctx = makeCtx({ units: [a], deterministic: true });
    const hits = [];
    for (let r = 1; r <= 12; r += 1) {
      ctx.round = r;
      if (evalCondition({ round: { from: 3, every: 4 } }, ctx, a)) hits.push(r);
    }
    expect(hits).toEqual([3, 7, 11]);
  });

  it('targetClass, targetShielded, selfHpBelowTarget, otherAlliesAtMost', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet({ hp: 100 }), hp: 40 });
    const d = unit({ key: 'd', side: 'defenders', position: 4, kit: kit({ class: 'guardian' }), sheet: sheet({ hp: 100 }), hp: 90 });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    expect(evalCondition({ targetClass: 'guardian' }, ctx, a, d)).toBe(true);
    expect(evalCondition({ targetShielded: true }, ctx, a, d)).toBe(false);
    d.shieldHp = 10;
    expect(evalCondition({ targetShielded: true }, ctx, a, d)).toBe(true);
    expect(evalCondition({ selfHpBelowTarget: true }, ctx, a, d)).toBe(true);
    expect(evalCondition({ otherAlliesAtMost: 0 }, ctx, a)).toBe(true);
  });

  it('hasTag prefers tagged units and excludeSelf never picks the caster', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const b = unit({ key: 'b', side: 'attackers', position: 4 });
    const e1 = unit({ key: 'e1', side: 'defenders', position: 4 });
    const e2 = unit({ key: 'e2', side: 'defenders', position: 5 });
    const ctx = makeCtx({ units: [a, b, e1, e2], deterministic: true });
    e2.buffs.push({ tag: 'confined', kind: 'control', source: 'a' });
    expect(selectFor(ctx, a, { hasTag: 'confined' }).map((u) => u.key)).toEqual(['e2']);
    expect(selectFor(ctx, a, { side: 'ally', rule: 'same_position', excludeSelf: true }).map((u) => u.key)).toEqual(['b']);
  });
});

describe('E3 controls and buffs', () => {
  it('flinch stops the basic skill; disarm lets only a ready ultimate fire', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 4, kit: kit({ talents: { basicRate: 1 } }), rage: 0 });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1e9 }) });
    const ctx = makeCtx({ units: [a, d], seed: 2 });
    landControl(ctx, d, a, 'flinch');
    takeTurn(ctx, a, { bigRound: 1, team });
    expect(ctx.events.filter((e) => e.type === 'action').at(-1)).toMatchObject({ skill: 'normal' });
    a.buffs = [];
    landControl(ctx, d, a, 'disarm');
    takeTurn(ctx, a, { bigRound: 1, team });
    expect(ctx.events.filter((e) => e.type === 'action').at(-1)).toMatchObject({ skill: null });
  });

  it('a Crit Seal stops crits', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 4, sheet: sheet({ crit: 5 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4 });
    const ctx = makeCtx({ units: [a, d], seed: 5 });
    expect(computeDamage({ attacker: a, defender: d, skill: skill({ slot: 'normal' }), hitIndex: 0, team }, ctx).crit).toBe(true);
    landControl(ctx, d, a, 'critSeal');
    expect(computeDamage({ attacker: a, defender: d, skill: skill({ slot: 'normal' }), hitIndex: 0, team }, ctx).crit).toBe(false);
  });

  it('a targeted immunity stops only the named control or DoT', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const t = unit({ key: 't', side: 'defenders', position: 4 });
    const ctx = makeCtx({ units: [a, t], deterministic: true });
    t.buffs.push({ tag: 'ice-body', kind: 'immune', source: 't', immuneTo: ['freeze', 'burning'] });
    applyControl(ctx, a, [t], { kind: 'freeze', chance: null });
    applyControl(ctx, a, [t], { kind: 'stun', chance: null });
    expect(t.buffs.some((b) => b.tag === 'freeze')).toBe(false);
    expect(t.buffs.some((b) => b.tag === 'stun')).toBe(true);
    applyDotTag(ctx, a, t, 'burning', { share: 0.1 }, 'P');
    expect(t.buffs.some((b) => b.kind === 'dot')).toBe(false);
  });

  it('stacking DoTs keep a buff per stack up to the cap; dotTaken raises their damage', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const t = unit({ key: 't', side: 'defenders', position: 4, sheet: sheet({ hp: 10000 }) });
    const ctx = makeCtx({ units: [a, t], deterministic: true });
    for (let i = 0; i < 4; i += 1) applyDotTag(ctx, a, t, 'poison', { share: 0.01, basis: 'targetMaxHp', maxStacks: 3 }, 'S');
    expect(t.buffs.filter((b) => b.kind === 'dot')).toHaveLength(3);
    expect(evalCondition({ targetStackAtLeast: { tag: 'poison', n: 3 } }, ctx, a, t)).toBe(true);
    t.buffs.push({ tag: 'wounds', kind: 'stat', source: 'a', field: 'dotTaken', amount: 0.5 });
    tickDots(ctx, t);
    expect(10000 - t.hp).toBe(3 * 150);
  });

  it('rageBlock holds except for a forced refill (Solgaleo)', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1, rage: 0 });
    const ctx = makeCtx({ units: [a], deterministic: true });
    a.buffs.push({ tag: 'sun', kind: 'rageBlock', source: 'a', turns: 99 });
    addRage(ctx, a, 500);
    expect(a.rage).toBe(0);
    applyEffectList(ctx, a, [{ op: 'rage', target: { side: 'ally', rule: 'self' }, fill: true, force: true }], 'P', []);
    expect(a.rage).toBe(1000);
  });
});

describe('E3 damage', () => {
  it('endure leaves the holder at 1 HP once, then onEndure runs (invulnerable to round end)', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    d.triggers = [{ on: 'onEndure', buff: { tag: 'shelter', kind: 'invulnerable', bigRounds: 1 } }];
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    d.buffs.push({ tag: 'endure', kind: 'endure', source: 'd' });
    channelHit(ctx, a, d, 5000);
    expect(d.alive).toBe(true);
    expect(d.hp).toBe(1);
    channelHit(ctx, a, d, 5000);
    expect(d.hp).toBe(1);
    d.buffs = [];
    channelHit(ctx, a, d, 5000);
    expect(d.alive).toBe(false);
  });

  it('defend mods scale with missing HP (Zacian: 1% per 2% lost, up to 30%) and P/S reduction splits by type', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 4, sheet: sheet({ pAtk: 1000, sAtk: 1000 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }), hp: 1000 });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    const hit = (type: 'P' | 'S') => computeDamage({ attacker: a, defender: d, skill: skill({ slot: 'normal', type }), hitIndex: 0, team }, ctx).dmg;
    const plain = hit('P');
    d.damageMods = [{ tag: 'z', role: 'defend', dmg: 0.5, scale: 'selfMissingHp', cap: 0.3 }];
    d.hp = 800; // 20% lost → 10%
    expect(hit('P')).toBe(Math.floor(plain * 0.9));
    d.hp = 100; // capped at 30%
    expect(hit('P')).toBe(Math.floor(plain * 0.7));
    d.damageMods = [];
    d.base.pRdct = 0.2;
    expect(hit('P')).toBe(Math.floor(plain * 0.8));
    expect(hit('S')).toBe(plain);
  });

  it('a kit damage mod can scale with a resource (Necrozma: +30% per light energy)', () => {
    const k = kit({ talents: { damageMods: [{ tag: 'light', slot: 'ult', atk: 0.3, scale: { resource: 'light' } }] } });
    const a = unit({ key: 'a', side: 'attackers', position: 4, kit: k, sheet: sheet({ pAtk: 1000 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4 });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    const ult = skill({ slot: 'ult' });
    const base = computeDamage({ attacker: a, defender: d, skill: ult, hitIndex: 0, team }, ctx).dmg;
    a.resources = { light: 2 };
    expect(computeDamage({ attacker: a, defender: d, skill: ult, hitIndex: 0, team }, ctx).dmg).toBe(Math.floor(base * 1.6));
  });

  it('a consumeOnHit layer is spent by a direct hit', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const d = unit({ key: 'd', side: 'defenders', position: 4 });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    d.buffs.push({ tag: 'airflow#0', kind: 'stat', source: 'a', field: 'dmgRdct', amount: 0.3, consumeOnHit: true });
    d.buffs.push({ tag: 'airflow#1', kind: 'stat', source: 'a', field: 'dmgRdct', amount: 0.3, consumeOnHit: true });
    channelHit(ctx, a, d, 10);
    expect(d.buffs.filter((b) => b.tag.startsWith('airflow'))).toHaveLength(1);
  });

  it('endsWithSource buffs vanish when their source dies', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const ally = unit({ key: 'b', side: 'attackers', position: 2 });
    const d = unit({ key: 'd', side: 'defenders', position: 4 });
    const ctx = makeCtx({ units: [a, ally, d], deterministic: true });
    ally.buffs.push({ tag: 'leycrest', kind: 'stat', source: a.id, field: 'critRes', amount: 0.05, endsWithSource: true });
    channelHit(ctx, d, a, 1e9);
    expect(ally.buffs).toHaveLength(0);
  });

  it('onHit passes the damage taken (Celebi heals 40% of it)', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 10000 }) });
    d.triggers = [{ on: 'onHit', effects: [{ op: 'heal', target: { side: 'ally', rule: 'self' }, rate: 0.4, basis: 'eventDamage' }] }];
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    channelHit(ctx, a, d, 1000);
    expect(d.hp).toBe(10000 - 1000 + 400);
  });
});

describe('E3 extra actions and splash', () => {
  it('an extra action casts the slot again without costing Rage', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 4, rage: 0 });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1e9 }) });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    extraAction(ctx, a, 'ult', true, team);
    expect(ctx.events.some((e) => e.type === 'action' && e.skill === 'ult')).toBe(true);
    expect(a.rage).toBe(0);
  });

  it('splash hits the neighbours of the event target for a share of the damage it took', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 4 });
    const main = unit({ key: 'm', side: 'defenders', position: 5, sheet: sheet({ hp: 1e6 }) });
    const left = unit({ key: 'l', side: 'defenders', position: 4, sheet: sheet({ hp: 1e6 }) });
    const behind = unit({ key: 'b', side: 'defenders', position: 2, sheet: sheet({ hp: 1e6 }) });
    const far = unit({ key: 'f', side: 'defenders', position: 1, sheet: sheet({ hp: 1e6 }) });
    const ctx = makeCtx({ units: [a, main, left, behind, far], deterministic: true });
    ctx.castDamage = new Map([['m', 1000]]);
    a.triggers = [{ on: 'afterBasic', effects: [{ op: 'splash', target: { event: true }, share: 0.1 }] }];
    fireTriggers(ctx, a, 'afterBasic', { target: main });
    expect(1e6 - left.hp).toBe(100);
    expect(1e6 - behind.hp).toBe(100);
    expect(far.hp).toBe(1e6);
  });
});

describe('onEnemyDeath (owner 2026-10-31: Mew counts every fallen enemy)', () => {
  it('fires for the other side whoever made the kill', () => {
    const killer = unit({ key: 'k', side: 'attackers', position: 1 });
    const mew = unit({ key: 'm', side: 'attackers', position: 2, rage: 0 });
    mew.triggers = [{ on: 'onEnemyDeath', rage: 250 }];
    const foe = unit({ key: 'f', side: 'defenders', position: 4 });
    const ctx = makeCtx({ units: [killer, mew, foe], deterministic: true });
    channelHit(ctx, killer, foe, 1e9);
    expect(mew.rage).toBe(250);
  });
});
