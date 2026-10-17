import { describe, expect, it } from 'vitest';
import { computeDamage, channelHit } from './damage';
import { kit, makeCtx, sheet, skill, unit } from './fixtures';
import { selectTargets } from './targeting';
import { takeTurn } from './skills';
import type { Combatant, KitDef } from './types';

/** M9.1: targeting + damage primitives. */

// Positions 1-3 are the back row (columns 1-3); 4-6 the front row (columns 1-3).
function defenders(): Combatant[] {
  return [
    unit({ key: 'd1', side: 'defenders', position: 1, sheet: sheet({ hp: 100 }), hp: 100 }),
    unit({ key: 'd2', side: 'defenders', position: 2, sheet: sheet() }),
    unit({ key: 'd3', side: 'defenders', position: 4, sheet: sheet() }),
    unit({ key: 'd4', side: 'defenders', position: 5, sheet: sheet({ hp: 1000 }) }),
  ];
}

function atk(k: KitDef): Combatant {
  return unit({ key: 'a', side: 'attackers', position: 1, kit: k });
}

const team = { attackersPower: 100, defendersPower: 100 };

describe('M9.1 targeting rules', () => {
  it('frontline / backline select by row', () => {
    const k = kit({ skills: { normal: { rule: 'frontline' }, ult: { rule: 'backline' } } });
    const u = atk(k);
    const ctx = makeCtx({ units: [u, ...defenders()], deterministic: true });
    expect(selectTargets(ctx, u, k.skills.normal).map((t) => t.key)).toEqual(['d3', 'd4']);
    expect(selectTargets(ctx, u, k.skills.ult).map((t) => t.key)).toEqual(['d1', 'd2']);
  });

  it('highest_hp / highest_atk / highest_spd pick by the stat', () => {
    const k = kit({
      skills: {
        normal: { rule: 'highest_hp' },
        basic: { rule: 'highest_atk' },
        ult: { rule: 'highest_spd' },
      },
    });
    const u = atk(k);
    const ds = [
      unit({ key: 'd1', side: 'defenders', position: 1, sheet: sheet({ hp: 100 }), hp: 50 }),
      unit({ key: 'd2', side: 'defenders', position: 2, sheet: sheet({ hp: 1000 }), hp: 900 }),
      unit({ key: 'd3', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }), hp: 800 }),
      unit({ key: 'd4', side: 'defenders', position: 5, sheet: sheet({ hp: 1000 }), hp: 1000 }),
    ];
    ds[3]!.base.pAtk = 900; // d4 highest attack
    ds[1]!.base.spd = 500; // d2 highest speed
    const ctx = makeCtx({ units: [u, ...ds], deterministic: true });
    expect(selectTargets(ctx, u, k.skills.normal)[0]!.key).toBe('d4'); // highest hp ratio
    expect(selectTargets(ctx, u, k.skills.basic)[0]!.key).toBe('d4'); // highest atk
    expect(selectTargets(ctx, u, k.skills.ult)[0]!.key).toBe('d2'); // highest spd
  });

  it('rowFilter narrows a random pick to the back row', () => {
    const k = kit({ skills: { normal: { rule: 'random', targets: 1, rowFilter: 'back' } } });
    const u = atk(k);
    const ctx = makeCtx({ units: [u, ...defenders()], seed: 5 });
    for (let i = 0; i < 20; i += 1) {
      const picked = selectTargets(ctx, u, k.skills.normal);
      expect(picked).toHaveLength(1);
      expect(['d1', 'd2']).toContain(picked[0]!.key);
    }
  });

  it('same_position matches the caster column and prefers its row', () => {
    const k = kit({ skills: { normal: { rule: 'same_position' } } });
    const u = atk(k); // column 1, back row
    const ctx = makeCtx({ units: [u, ...defenders()], deterministic: true });
    expect(selectTargets(ctx, u, k.skills.normal)[0]!.key).toBe('d1'); // back-row column 1
  });

  it('adjacent takes the main target plus same-row neighbours', () => {
    const k = kit({ skills: { normal: { rule: 'adjacent' } } });
    const u = atk(k);
    const ctx = makeCtx({ units: [u, ...defenders()], deterministic: true });
    expect(selectTargets(ctx, u, k.skills.normal).map((t) => t.key)).toEqual(['d3', 'd4']);
  });

  it('side: ally targets the caster team', () => {
    const k = kit({ skills: { normal: { rule: 'all', side: 'ally' } } });
    const u = atk(k);
    const ally = unit({ key: 'b', side: 'attackers', position: 2, sheet: sheet() });
    const ctx = makeCtx({ units: [u, ally, ...defenders()], deterministic: true });
    expect(selectTargets(ctx, u, k.skills.normal).map((t) => t.key)).toEqual(['a', 'b']);
  });

  it('filters narrow to controlled targets', () => {
    const k = kit({ skills: { normal: { rule: 'all', filters: ['controlled'] } } });
    const u = atk(k);
    const ds = defenders();
    ds[2]!.buffs.push({ tag: 'stun', kind: 'control', source: 'x', turns: 1 });
    const ctx = makeCtx({ units: [u, ...ds], deterministic: true });
    expect(selectTargets(ctx, u, k.skills.normal).map((t) => t.key)).toEqual(['d3']);
  });

  it('a failing skill condition falls back to a plain column pick', () => {
    const k = kit({ skills: { normal: { rule: 'all', condition: { selfHpBelow: 0.5 } } } });
    const u = atk(k); // full HP
    const ctx = makeCtx({ units: [u, ...defenders()], deterministic: true });
    expect(selectTargets(ctx, u, k.skills.normal)).toHaveLength(1);
  });
});

describe('M9.1 damage primitives', () => {
  it('hpShareBasis max / current / missing', () => {
    const build = (basis: 'max' | 'current' | 'missing'): number => {
      const k = kit({ skills: { normal: { damageType: 'hpShare', hpShare: 0.5, hpShareBasis: basis } } });
      const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k });
      const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }), hp: 400 });
      const ctx = makeCtx({ units: [a, d], deterministic: true });
      return computeDamage({ attacker: a, defender: d, skill: k.skills.normal, hitIndex: 0, team }, ctx).dmg;
    };
    expect(build('max')).toBe(500);
    expect(build('current')).toBe(200);
    expect(build('missing')).toBe(300);
  });

  it('true damage ignores every factor, both rolls and shields', () => {
    const k = kit({ skills: { normal: { trueDamage: true, rates: [1.0] } } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet({ pAtk: 200 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000, dmgRdct: 0.9 }), shieldHp: 500 });
    const ctx = makeCtx({ units: [a, d], deterministic: false, seed: 3 });
    const out = computeDamage({ attacker: a, defender: d, skill: k.skills.normal, hitIndex: 0, team }, ctx);
    expect(out.dmg).toBe(200);
    expect(out.crit).toBe(false);
    channelHit(ctx, a, d, out.dmg, { trueDmg: out.trueDmg });
    expect(d.shieldHp).toBe(500); // shield untouched
    expect(d.hp).toBe(800);
  });

  it('ignoreShield punches through a shield', () => {
    const k = kit({ skills: { normal: { ignoreShield: true, rates: [1.0] } } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet({ pAtk: 200 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }), shieldHp: 500 });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    const out = computeDamage({ attacker: a, defender: d, skill: k.skills.normal, hitIndex: 0, team }, ctx);
    channelHit(ctx, a, d, out.dmg, { ignoreShield: k.skills.normal.ignoreShield });
    expect(d.shieldHp).toBe(500);
    expect(d.hp).toBe(800);
  });

  it('bonusVs multiplies when its condition holds', () => {
    const k = kit({
      skills: { normal: { rates: [1.0], bonusVs: { condition: { targetHpBelow: 0.5 }, mult: 2 } } },
    });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet({ pAtk: 200 }) });
    const low = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }), hp: 100 });
    const high = unit({ key: 'e', side: 'defenders', position: 5, sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [a, low, high], deterministic: true });
    expect(computeDamage({ attacker: a, defender: low, skill: k.skills.normal, hitIndex: 0, team }, ctx).dmg).toBe(400);
    expect(computeDamage({ attacker: a, defender: high, skill: k.skills.normal, hitIndex: 0, team }, ctx).dmg).toBe(200);
  });
});

describe('M9.1 structured DoT & recast', () => {
  it('a casterAtk DoT ticks the caster-attack share each big round', () => {
    const k = kit({
      skills: { normal: { rates: [0], dot: { share: 0.1, basis: 'casterAtk', type: 'S', turns: 2 } } },
    });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet({ sAtk: 200 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    takeTurn(ctx, a, { bigRound: 1, team });
    expect(d.hp).toBeLessThan(1000); // rates[0] = 0 still floors at 1 damage + DoT applied
    const before = d.hp;
    takeTurn(ctx, d, { bigRound: 1, team });
    expect(d.hp).toBe(before - 20); // 0.1 × 200 S.ATK
  });

  it('recastOnKill re-casts while it keeps killing, up to max', () => {
    const k = kit({ skills: { normal: { rates: [1.0], recastOnKill: { max: 2 } } } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet({ pAtk: 500 }) });
    const soft = [1, 2, 3].map((p) =>
      unit({ key: `s${p}`, side: 'defenders', position: p, sheet: sheet({ hp: 100 }), hp: 100 }),
    );
    const ctx = makeCtx({ units: [a, ...soft], deterministic: true });
    takeTurn(ctx, a, { bigRound: 1, team });
    const dead = ctx.units.filter((u) => u.side === 'defenders' && !u.alive).length;
    expect(dead).toBe(3); // 1 cast + 2 recasts, each picking the next column
  });

  it('without recastOnKill only one target dies per action', () => {
    const k = kit({ skills: { normal: { rates: [1.0] } } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet({ pAtk: 500 }) });
    const soft = [1, 2, 3].map((p) =>
      unit({ key: `s${p}`, side: 'defenders', position: p, sheet: sheet({ hp: 100 }), hp: 100 }),
    );
    const ctx = makeCtx({ units: [a, ...soft], deterministic: true });
    takeTurn(ctx, a, { bigRound: 1, team });
    expect(ctx.units.filter((u) => u.side === 'defenders' && !u.alive)).toHaveLength(1);
  });
});

describe('M9.1 fixtures stay additive', () => {
  it('skill() still builds the M1 shape', () => {
    const s = skill({ slot: 'normal' });
    expect(s.rule).toBe('column');
    expect(s.side).toBeUndefined();
  });
});
