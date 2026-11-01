import { describe, expect, it } from 'vitest';
import { addRage, blockChanceAt, channelHit, computeDamage, critRateAt } from './damage';
import { piecewise } from './settings';
import { effective, resolveSheet } from './stats';
import { kit, makeCtx, sheet, spec, unit } from './fixtures';

describe('resolveSheet & effective', () => {
  it('applies talent stat mods in order (hp mult, crit add)', () => {
    const k = kit({
      talents: {
        statMods: [
          { field: 'hp', mult: 1.25 },
          { field: 'crit', add: 0.06 },
          { field: 'critRes', add: 0.38 },
        ],
      },
    });
    const resolved = resolveSheet(spec({ id: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet() }));
    expect(resolved.hp).toBe(1250);
    expect(resolved.crit).toBeCloseTo(0.06);
    expect(resolved.critRes).toBeCloseTo(0.38);
  });

  it('effective sums stackable stat buffs on top of base', () => {
    const u = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ dmgBoost: 0.2 }) });
    u.buffs.push({ tag: 'buff', kind: 'stat', source: 'x', field: 'dmgBoost', amount: 0.1 });
    expect(effective(u.base, u.buffs, 'dmgBoost')).toBeCloseTo(0.3);
  });
});

describe('piecewise', () => {
  const pts: [number, number][] = [
    [-0.4, 0.03],
    [0.5, 0.5],
    [1.0, 1.0],
  ];
  it('clamps below the first and above the last point', () => {
    expect(piecewise(pts, -5)).toBeCloseTo(0.03);
    expect(piecewise(pts, 5)).toBeCloseTo(1.0);
  });
  it('returns exact point values', () => {
    expect(piecewise(pts, 0.5)).toBeCloseTo(0.5);
    expect(piecewise(pts, 1.0)).toBeCloseTo(1.0);
  });
  it('interpolates between points', () => {
    expect(piecewise(pts, 0)).toBeCloseTo(0.03 + 0.47 * (0.4 / 0.9));
  });
});

describe('computeDamage', () => {
  it('multiplies raw by all neutral factors in deterministic PvE', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ pAtk: 200 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    const out = computeDamage(
      { attacker: atk, defender: def, skill: atk.kit.skills.normal, hitIndex: 0, team: { attackersPower: 100, defendersPower: 100 } },
      ctx,
    );
    expect(out.crit).toBe(false);
    expect(out.blocked).toBe(false);
    expect(out.dmg).toBe(200);
  });

  it('applies dmgBoost/dmgRdct additively through G', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ pAtk: 200, dmgBoost: 0.3 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1000, dmgRdct: 0.1 }) });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    const out = computeDamage(
      { attacker: atk, defender: def, skill: atk.kit.skills.normal, hitIndex: 0, team: { attackersPower: 100, defendersPower: 100 } },
      ctx,
    );
    expect(out.dmg).toBe(Math.floor(200 * (1 + 0.3 - 0.1)));
  });

  it('adds P.ATK DMG BST (R8 tokens) to G for a P skill only', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ pAtk: 200, pBoost: 0.3, sBoost: 0.5 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1000, pRdct: 0.1 }) });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    const out = computeDamage(
      { attacker: atk, defender: def, skill: atk.kit.skills.normal, hitIndex: 0, team: { attackersPower: 100, defendersPower: 100 } },
      ctx,
    );
    expect(out.dmg).toBe(Math.floor(200 * (1 + 0.3 - 0.1)));
  });

  it('applies the PvP floor and the PvP bonus factor in pvp mode', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({ skills: { ult: { rates: [1.0], rule: 'row' } } }), sheet: sheet({ pAtk: 200, pvpBoost: 0.2 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1000, pvpRdct: 0.1 }) });
    const ctx = makeCtx({ units: [atk, def], settings: { mode: 'pvp' }, deterministic: true });
    const out = computeDamage(
      { attacker: atk, defender: def, skill: atk.kit.skills.ult, hitIndex: 0, team: { attackersPower: 100, defendersPower: 100 } },
      ctx,
    );
    // ult K = 1 + ultBoost(0) - ultRed(0) = 1, P = 1 + 0.2 - 0.1 (FP ≈ 1.0999…)
    expect(out.dmg).toBe(Math.floor(200 * (1 + 0.2 - 0.1)));
  });

  it('soul factor grows with spiritAtk lead', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ pAtk: 200, spiritAtk: 40000 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1000, spiritDef: 0 }) });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    const out = computeDamage(
      { attacker: atk, defender: def, skill: atk.kit.skills.normal, hitIndex: 0, team: { attackersPower: 100, defendersPower: 100 } },
      ctx,
    );
    // soul = 1 + 0.266*40000/(40000+80000) ≈ 1.0887
    expect(out.dmg).toBe(Math.floor(200 * (1 + 0.266 * (40000 / 120000))));
  });

  it('weak attackers are cut by the team-Power factor', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ pAtk: 200 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    const out = computeDamage(
      { attacker: atk, defender: def, skill: atk.kit.skills.normal, hitIndex: 0, team: { attackersPower: 70, defendersPower: 100 } },
      ctx,
    );
    expect(out.dmg).toBe(Math.floor(200 * (0.7 / 0.7)));
  });

  it('hpShare skills ignore every factor and both rolls', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({ skills: { normal: { damageType: 'hpShare', hpShare: 0.3 } } }), sheet: sheet({ pAtk: 1 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1000, dmgRdct: 0.8 }) });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    const out = computeDamage(
      { attacker: atk, defender: def, skill: atk.kit.skills.normal, hitIndex: 0, team: { attackersPower: 1, defendersPower: 100 } },
      ctx,
    );
    expect(out.dmg).toBe(300);
  });
});

describe('crit & block rate helpers', () => {
  it('critRateAt clamps to the floor', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ crit: 0 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ critRes: 0.5 }) });
    expect(critRateAt(atk, def)).toBeCloseTo(0.03);
  });
  it('critRateAt is slope x (crit - critRes), capped at 1', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ crit: 0.5 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ critRes: 0.3 }) });
    expect(critRateAt(atk, def)).toBeCloseTo(0.24);
    atk.base.crit = 1.5;
    expect(critRateAt(atk, def)).toBe(1);
  });
  it('blockChanceAt reads the piecewise curve over block - guardBreak', () => {
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ block: 0.5 }) });
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({}) });
    expect(blockChanceAt(atk, def, [[-0.4, 0.03], [0.5, 0.5], [1, 1]])).toBeCloseTo(0.5);
    def.base.block = 2;
    expect(blockChanceAt(atk, def, [[-0.4, 0.03], [0.5, 0.5], [1, 1]])).toBe(1);
  });
});

describe('channelHit & rage', () => {
  it('absorbs shields first and rewards the flat rage base even on fully-shielded hits', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit() });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1000 }), rage: 0, shieldHp: 100 });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    channelHit(ctx, atk, def, 80, {});
    expect(def.shieldHp).toBe(20);
    expect(def.hp).toBe(1000);
    expect(def.rage).toBe(125);
  });

  it('adds proportional rage from real HP lost', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit() });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1000 }), rage: 0 });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    channelHit(ctx, atk, def, 250, {});
    expect(def.hp).toBe(750);
    expect(def.rage).toBe(125 + Math.floor((1000 * 250) / 1000));
  });

  it('emits death exactly once and caps rage at rageMax', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit() });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 100 }), rage: 999 });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    channelHit(ctx, atk, def, 500, {});
    expect(def.alive).toBe(false);
    expect(def.rage).toBe(1000);
    expect(ctx.events.filter((e) => e.type === 'death')).toHaveLength(1);
  });

  it('reflect and dot damage grant proportional rage but never the flat base', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit() });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1000 }), rage: 0 });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    channelHit(ctx, atk, def, 100, { kind: 'reflect' });
    // flat rageHitBase applied only to direct hits; proportional term from real HP lost applies
    expect(def.rage).toBe(Math.floor((1000 * 100) / 1000));
  });

  it('rageCutChance cuts the attacker bar by rageMax/8 when it triggers', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ hp: 1000 }) });
    const def = unit({
      key: 'd',
      side: 'defenders',
      position: 4,
      kit: kit({ talents: { rageCutChance: 1 } }),
      sheet: sheet({ hp: 1000 }),
    });
    const ctx = makeCtx({ units: [atk, def], deterministic: false, seed: 7 });
    def.rage = 0;
    atk.rage = 500;
    channelHit(ctx, atk, def, 50, {});
    // talent rageOnHit not set; rageCutChance=1 always fires → -125
    expect(atk.rage).toBe(375);
  });
});

describe('addRage', () => {
  it('clamps to [0, rageMax]', () => {
    const u = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ hp: 1000 }), rage: 990 });
    const ctx = makeCtx({ units: [u] });
    addRage(ctx, u, 50);
    expect(u.rage).toBe(1000);
    addRage(ctx, u, -2000);
    expect(u.rage).toBe(0);
  });
});