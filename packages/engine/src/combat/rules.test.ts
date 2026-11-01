import { describe, expect, it } from 'vitest';
import { countEvents, kit, lastEvent, makeCtx, sheet, skill, unit } from './fixtures';
import { selectTargets, orderedByColumn } from './targeting';
import { applyBuff, countStacks, tickBigRoundBuffs, tickUnitBuffs } from './buffs';
import { applyHeal, applyShield, applyLifesteal, resolveHealAmount } from './sustain';
import { takeTurn } from './skills';
import type { SheetInput } from './types';

function sixVs(xs: Partial<SheetInput> = {}, ds: Partial<SheetInput> = {}): ReturnType<typeof unit>[] {
  const attackers = [1, 2, 3, 4, 5, 6].map((p) =>
    unit({ key: `a${p}`, side: 'attackers', position: p, sheet: sheet({ hp: 1000, pAtk: 200, spd: 100, ...xs }) }),
  );
  const defenders = [1, 2, 3, 4, 5, 6].map((p) =>
    unit({ key: `d${p}`, side: 'defenders', position: p, sheet: sheet({ hp: 1000, pAtk: 200, spd: 100, ...ds }) }),
  );
  return [...attackers, ...defenders];
}

describe('targeting', () => {
  it('column rule hits the front-row unit in the attacker column, then nearest', () => {
    const units = sixVs();
    const ctx = makeCtx({ units });
    const atk = units.find((u) => u.key === 'a1')!;
    // a1 is back-row column 1 → d4 is front-row column 1
    let t = selectTargets(ctx, atk, skill({ slot: 'normal', type: 'P', rates: [1], rule: 'column' }));
    expect(t[0]!.key).toBe('d4');
    // kill d4 → nearest front column is 2 → d5
    units.find((u) => u.key === 'd4')!.alive = false;
    t = selectTargets(ctx, atk, skill({ slot: 'normal', type: 'P', rates: [1], rule: 'column' }));
    expect(t[0]!.key).toBe('d5');
  });

  it('row rule takes the row of the first column target', () => {
    const units = sixVs();
    const ctx = makeCtx({ units });
    const atk = units.find((u) => u.key === 'a1')!;
    const t = selectTargets(ctx, atk, skill({ slot: 'ult', type: 'P', rates: [1], rule: 'row' }));
    expect(t.map((u) => u.key).sort()).toEqual(['d4', 'd5', 'd6']);
  });

  it('lowest_hp picks the most-relative-hurt unit', () => {
    const units = sixVs();
    const d4 = units.find((u) => u.key === 'd4')!;
    d4.hp = 10;
    const d6 = units.find((u) => u.key === 'd6')!;
    d6.hp = 200;
    const ctx = makeCtx({ units });
    const atk = units.find((u) => u.key === 'a1')!;
    const t = selectTargets(ctx, atk, skill({ slot: 'ult', type: 'P', rates: [1], rule: 'lowest_hp', targets: 1 }));
    expect(t[0]!.key).toBe('d4');
  });

  it('self targets the caster', () => {
    const units = sixVs();
    const ctx = makeCtx({ units });
    const atk = units.find((u) => u.key === 'a1')!;
    const t = selectTargets(ctx, atk, skill({ slot: 'normal', type: 'P', rates: [1], rule: 'self' }));
    expect(t[0]!.key).toBe('a1');
  });

  it('skips confined (untargetable) units', () => {
    const units = sixVs();
    const d4 = units.find((u) => u.key === 'd4')!;
    d4.buffs.push({ tag: 'confinement', kind: 'control', source: 'x' });
    const ctx = makeCtx({ units });
    const atk = units.find((u) => u.key === 'a1')!;
    const t = selectTargets(ctx, atk, skill({ slot: 'normal', type: 'P', rates: [1], rule: 'column' }));
    expect(t[0]!.key).toBe('d5');
  });

  it('orderedByColumn is column-major, front before back', () => {
    const units = sixVs();
    expect(orderedByColumn(units).map((u) => u.key)).toEqual([...[...units].filter((u) => u.row === 'front').sort((a, b) => a.column - b.column).map((u) => u.key), ...[...units].filter((u) => u.row === 'back').sort((a, b) => a.column - b.column).map((u) => u.key)]);
  });
});

describe('buffs', () => {
  it('refresh, never stack for live same-tag buffs', () => {
    const u = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet() });
    const ctx = makeCtx({ units: [u] });
    applyBuff(u, { tag: 'rip', kind: 'stat', field: 'dmgBoost', amount: 0.1, turns: 2 }, ctx, 'src');
    applyBuff(u, { tag: 'rip', kind: 'stat', field: 'dmgBoost', amount: 0.1, turns: 2 }, ctx, 'src');
    expect(u.buffs.filter((b) => b.tag === 'rip')).toHaveLength(1);
  });

  it('stacking buffs cap at maxStacks with per-stack tags', () => {
    const u = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet() });
    const ctx = makeCtx({ units: [u] });
    for (let i = 0; i < 5; i += 1) {
      applyBuff(u, { tag: 'grit', kind: 'stat', field: 'dmgRdct', amount: 0.03, maxStacks: 4 }, ctx, 'src');
    }
    expect(countStacks(u, 'grit')).toBe(4);
    expect(u.buffs.length).toBe(4);
  });

  it('tickUnitBuffs counts holder turns and expires at zero', () => {
    const u = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet() });
    u.buffs.push({ tag: 'w', kind: 'stat', field: 'dmgBoost', amount: 0.1, turns: 1, source: 'x' });
    u.buffs.push({ tag: 'dots', kind: 'dot', source: 'x', amount: 0.05, bigRounds: 2 });
    const ctx = makeCtx({ units: [u] });
    tickUnitBuffs(u, ctx);
    expect(u.buffs.some((b) => b.tag === 'w')).toBe(false);
    // dot duration is big-round based: untouched by the unit tick
    expect(u.buffs.some((b) => b.tag === 'dots')).toBe(true);
  });

  it('tickBigRoundBuffs expires big-round durations', () => {
    const u = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet() });
    u.buffs.push({ tag: 'conf', kind: 'confusion', source: 'x', redirectChance: 0.7, bigRounds: 1 });
    const ctx = makeCtx({ units: [u] });
    tickBigRoundBuffs(u, ctx);
    expect(u.buffs).toHaveLength(0);
  });
});

describe('sustain', () => {
  it('heal scales with caster healBoost and target receiveHealBoost', () => {
    const caster = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({}), sheet: sheet({ hp: 1000, healBoost: 0.1 }) });
    const target = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000, receiveHealBoost: 0.2 }), hp: 500 });
    const ctx = makeCtx({ units: [caster, target] });
    const amount = resolveHealAmount(ctx, caster, target, 0.2);
    expect(amount).toBe(Math.floor(0.2 * 1000 * 1.1 * 1.2));
    applyHeal(ctx, target, amount);
    expect(target.hp).toBe(500 + amount);
    expect(lastEvent(ctx, 'heal')?.amount).toBe(amount);
  });

  it('heal never exceeds maxHp and lifesteal only heals actual damage', () => {
    const caster = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({}), sheet: sheet({ hp: 1000 }) });
    const target = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }), hp: 999 });
    const ctx = makeCtx({ units: [caster, target] });
    applyHeal(ctx, target, 1000);
    expect(target.hp).toBe(1000);
    applyLifesteal(ctx, caster, 0, 0.5);
    expect(caster.hp).toBe(1000);
  });

  it('shields scale with caster max HP and absorb first', () => {
    const caster = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet({ hp: 2000 }) });
    const target = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [caster, target] });
    applyShield(ctx, target, 0.5, caster);
    expect(target.shieldHp).toBe(1000);
  });
});

describe('takeTurn actions', () => {
  it('normal action grants ragePerAction to a SKILL-class unit only (owner 2026-10-31)', () => {
    for (const [cls, want] of [['adept', 250], ['striker', 0], ['guardian', 0]] as const) {
      const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({ class: cls }), sheet: sheet(), rage: 0 });
      const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 100000 }) });
      const ctx = makeCtx({ units: [atk, def], deterministic: true });
      takeTurn(ctx, atk, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
      expect(atk.rage, cls).toBe(want);
    }
  });

  it('ultimate costs 1000 rage and takes the row', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({ skills: { ult: { rates: [1.4], rule: 'row' } } }), sheet: sheet(), rage: 1000 });
    const defenders = [4, 5, 6].map((p) => unit({ key: `d${p}`, side: 'defenders', position: p, kit: kit(), sheet: sheet({ hp: 100000 }) }));
    const ctx = makeCtx({ units: [atk, ...defenders], deterministic: true });
    takeTurn(ctx, atk, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
    expect(atk.rage).toBe(0);
    expect(countEvents(ctx, 'hit')).toBe(3);
    const actions = ctx.events.filter((e) => e.type === 'action');
    expect(actions[actions.length - 1]!.skill).toBe('ult');
  });

  it('hard control skips exactly one turn with no action rage', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet(), rage: 0 });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet() });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    atk.buffs.push({ tag: 'stun', kind: 'control', source: 'd', turns: 1 });
    takeTurn(ctx, atk, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
    const action = lastEvent(ctx, 'action');
    expect(action?.skill).toBeNull();
    expect(atk.rage).toBe(0);
  });

  it('silence blocks the ultimate but allows normal skills', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({ skills: { normal: { rates: [1] } } }), sheet: sheet(), rage: 1000 });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 100000 }) });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    atk.buffs.push({ tag: 'silence', kind: 'silence', source: 'd', turns: 1 });
    takeTurn(ctx, atk, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
    expect(lastEvent(ctx, 'action')?.skill).toBe('normal');
    // full rage bar, silenced: no ultimate, rage clamps at rageMax still
    expect(atk.rage).toBe(1000);
    expect(ctx.events.some((e) => e.type === 'hit')).toBe(true);
  });

  it('paralysis casts its ultimate when ready, else skips', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet(), rage: 0 });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet() });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    atk.buffs.push({ tag: 'paralysis', kind: 'paralysis', source: 'd', turns: 1 });
    takeTurn(ctx, atk, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
    expect(lastEvent(ctx, 'action')?.skill).toBeNull();

    const atk2 = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({ skills: { ult: { rates: [1.4], rule: 'row' } } }), sheet: sheet(), rage: 1000 });
    atk2.buffs.push({ tag: 'paralysis', kind: 'paralysis', source: 'd', turns: 1 });
    const defs = [4, 5, 6].map((p) => unit({ key: `d${p}`, side: 'defenders', position: p, kit: kit(), sheet: sheet({ hp: 100000 }) }));
    const ctx2 = makeCtx({ units: [atk2, ...defs], deterministic: true });
    takeTurn(ctx2, atk2, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
    expect(lastEvent(ctx2, 'action')?.skill).toBe('ult');
  });

  it('confusion redirects only normal attacks (chance roll controls it)', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({ skills: { normal: { rates: [1] } } }), sheet: sheet(), rage: 0 });
    const ally = unit({ key: 'a2', side: 'attackers', position: 2, kit: kit(), sheet: sheet({ hp: 100000 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 100000 }) });
    atk.buffs.push({ tag: 'confusion', kind: 'confusion', source: 'd', redirectChance: 0.7, bigRounds: 1 });
    const ctx = makeCtx({ units: [atk, ally, def], deterministic: false, seed: 1 });
    takeTurn(ctx, atk, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
    const hits = ctx.events.filter((e) => e.type === 'hit');
    expect(hits.length).toBe(2);
    expect(hits.map((h) => h.tgt).sort()).toEqual(['a', 'a2']);
    expect(hits.some((h) => h.tgt === 'd')).toBe(false);
  });

  it('deterministic mode never redirects confusion', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({ skills: { normal: { rates: [1] } } }), sheet: sheet(), rage: 0 });
    const ally = unit({ key: 'a2', side: 'attackers', position: 2, kit: kit(), sheet: sheet({ hp: 100000 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 100000 }) });
    atk.buffs.push({ tag: 'confusion', kind: 'confusion', source: 'd', redirectChance: 0.7, bigRounds: 1 });
    const ctx = makeCtx({ units: [atk, ally, def], deterministic: true });
    takeTurn(ctx, atk, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
    const hits = ctx.events.filter((e) => e.type === 'hit');
    expect(hits.length).toBe(1);
    expect(hits[0]!.tgt).toBe('d');
  });

  it('DoT ticks at the start of the holder turn from maxHp', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({ skills: { normal: { damageType: 'dot', hpShare: 0.1, rates: [0] } } }), sheet: sheet() });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    takeTurn(ctx, atk, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
    expect(def.buffs.some((b) => b.kind === 'dot')).toBe(true);
    const before = def.hp;
    // the dot ticks at the start of the holder's own turn
    takeTurn(ctx, def, { bigRound: 2, team: { attackersPower: 100, defendersPower: 100 } });
    expect(def.hp).toBe(Math.max(0, before - 100));
  });
});
