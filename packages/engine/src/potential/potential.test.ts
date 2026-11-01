import { describe, expect, it } from 'vitest';
import { evalCondition } from '../combat/conditions';
import { channelHit } from '../combat/damage';
import { applyEffectList } from '../combat/effects';
import { kit, makeCtx, sheet, unit } from '../combat/fixtures';
import { fireTriggers } from '../combat/triggers';
import { resolveSheet } from '../combat/stats';
import type { SpecInput } from '../combat/types';
import { compilePotential } from './compile';
import { canUnlockTier, emptyPotential, levelShards, unlockShards } from './rules';
import type { PotentialOption, PotentialState, PotentialTable } from './types';

const opt = (id: number, effect: PotentialOption['effect'], values = [0.1, 0.12, 0.14, 0.16, 0.18, 0.2]): PotentialOption => ({
  id,
  name: `o${id}`,
  tier: Math.floor(id / 100) % 10,
  values,
  effect,
  text: '',
});

const TABLE: PotentialTable = {
  unlockStars: [7, 8, 9, 10, 11, 12, 13, 14, 15],
  costs: Array.from({ length: 9 }, (_, t) => [20000 + t, 26000, 34000, 60000, 90000, 130000]),
  maxLevel: 6,
  resetGems: 16,
  options: [
    opt(50102, { kind: 'factionAllies', field: 'atkPct', cap: 2 }),
    opt(50202, { kind: 'stat', field: 'hp', mult: true }),
    opt(50404, { kind: 'classAllyDmg', allyClass: 'guardian', role: 'defend', vs: 'striker' }),
    opt(50603, { kind: 'stat', field: 'atkPct', negate: true, extra: { field: 'spd', add: 8 } }),
    opt(50705, { kind: 'alive', below: 3, field: 'dmgRdct' }),
    opt(50906, { kind: 'event', on: 'onHit', hitBy: 'ult', target: 'self', act: 'heal', perTurn: 1 }),
  ],
  species: {
    mon: {
      tiers: [[50102, 1, 1], [50202, 1, 1], [1, 1, 1], [50404, 1, 1], [1, 1, 1], [50603, 1, 1], [50705, 1, 1], [1, 1, 1], [50906, 1, 1]],
      fodder: Array.from({ length: 9 }, () => [{ own: true, star: 5, count: 1 }]),
      core: false,
    },
  },
};

function picks(map: Record<number, number>): PotentialState {
  const s = emptyPotential();
  for (const [tier, lv] of Object.entries(map)) s.picks[Number(tier)] = { option: 0, lv };
  return s;
}

describe('R4 Potential rules', () => {
  it('tier N unlocks at 6 + N stars, in any order', () => {
    expect(canUnlockTier(TABLE, 6, 0)).toBe(false);
    expect(canUnlockTier(TABLE, 7, 0)).toBe(true);
    expect(canUnlockTier(TABLE, 15, 8)).toBe(true);
    expect(canUnlockTier(TABLE, 14, 8)).toBe(false);
  });

  it('costs: unlock is the tier base, then the five level steps; nothing past Lv 6', () => {
    expect(unlockShards(TABLE, 0)).toBe(20000);
    expect(levelShards(TABLE, 0, 1)).toBe(26000);
    expect(levelShards(TABLE, 0, 5)).toBe(130000);
    expect(levelShards(TABLE, 0, 6)).toBe(Infinity);
  });
});

describe('R4 Potential compile', () => {
  const team = { faction: 'water' as const, allies: [] as { faction: 'water' | 'fire'; className: 'guardian' | 'striker' }[] };

  it('faction allies count up to 2; stat lines use the picked level; penalties and extra lines', () => {
    const out = compilePotential(TABLE, TABLE.species['mon'], picks({ 0: 1, 1: 6, 5: 1 }), {
      ...team,
      allies: [
        { faction: 'water', className: 'striker' },
        { faction: 'water', className: 'striker' },
        { faction: 'water', className: 'striker' },
        { faction: 'fire', className: 'striker' },
      ],
    });
    expect(out.statMods).toEqual([
      { field: 'atkPct', add: 0.2 },
      { field: 'hp', mult: 1.2 },
      { field: 'atkPct', add: -0.1 },
      { field: 'spd', add: 8 },
    ]);
  });

  it('class-ally damage cut applies only with that class deployed', () => {
    expect(compilePotential(TABLE, TABLE.species['mon'], picks({ 3: 1 }), team).damageMods).toEqual([]);
    const withTank = compilePotential(TABLE, TABLE.species['mon'], picks({ 3: 2 }), {
      ...team,
      allies: [{ faction: 'fire', className: 'guardian' }],
    });
    expect(withTank.damageMods).toEqual([{ tag: 'potential-50404', role: 'defend', dmg: 0.12, condition: { targetClass: 'striker' } }]);
  });

  it('compiled stat mods reach the battle sheet', () => {
    const out = compilePotential(TABLE, TABLE.species['mon'], picks({ 1: 1 }), team);
    const spec: SpecInput = { id: 'x', name: 'x', position: 1, side: 'attackers', kit: kit(), sheet: sheet({ hp: 1000 }), statMods: out.statMods };
    expect(resolveSheet(spec).hp).toBe(1100);
  });
});

describe('R4 engine pieces', () => {
  const team = { faction: 'water' as const, allies: [] };
  it('alliesAlive conditions count the unit itself; removeBuff clears a tag', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const b = unit({ key: 'b', side: 'attackers', position: 2 });
    const d = unit({ key: 'd', side: 'defenders', position: 4 });
    const ctx = makeCtx({ units: [a, b, d], deterministic: true });
    expect(evalCondition({ alliesAliveAtLeast: 2 }, ctx, a)).toBe(true);
    expect(evalCondition({ alliesAliveBelow: 2 }, ctx, a)).toBe(false);
    b.alive = false;
    expect(evalCondition({ alliesAliveBelow: 2 }, ctx, a)).toBe(true);
    applyEffectList(ctx, a, [{ op: 'buff', target: { side: 'ally', rule: 'self' }, buff: { tag: 'p', kind: 'stat', field: 'dmgRdct', amount: 0.1 } }], 'P', [a]);
    expect(a.buffs.some((x) => x.tag === 'p')).toBe(true);
    applyEffectList(ctx, a, [{ op: 'removeBuff', target: { side: 'ally', rule: 'self' }, tag: 'p' }], 'P', [a]);
    expect(a.buffs.some((x) => x.tag === 'p')).toBe(false);
  });

  it('an alive option switches on when allies fall (Iron Pokémon below 3)', () => {
    const out = compilePotential(TABLE, TABLE.species['mon'], picks({ 6: 1 }), team);
    const owner = unit({ key: 'a', side: 'attackers', position: 1, kit: kit({ talents: { triggers: out.triggers } }) });
    const b = unit({ key: 'b', side: 'attackers', position: 2 });
    const c = unit({ key: 'c', side: 'attackers', position: 3 });
    const ctx = makeCtx({ units: [owner, b, c], deterministic: true });
    fireTriggers(ctx, owner, 'battleStart');
    expect(owner.buffs.some((x) => x.tag === 'potential-50705')).toBe(false);
    c.alive = false;
    fireTriggers(ctx, owner, 'onAllyDeath');
    expect(owner.buffs.some((x) => x.tag === 'potential-50705')).toBe(true);
  });

  it('onHit passes the attacker slot: Thick Fat heals only on an Ultimate hit, once a round', () => {
    const out = compilePotential(TABLE, TABLE.species['mon'], picks({ 8: 1 }), team);
    const d = unit({ key: 'd', side: 'defenders', position: 4, kit: kit({ talents: { triggers: out.triggers } }), sheet: sheet({ hp: 1000 }) });
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    channelHit(ctx, a, d, 300, { slot: 'normal' });
    expect(d.hp).toBe(700);
    channelHit(ctx, a, d, 100, { slot: 'ult' });
    expect(d.hp).toBe(700); // 600 + Lv 1's 10% of 1,000
    channelHit(ctx, a, d, 100, { slot: 'ult' });
    expect(d.hp).toBe(600); // once a round
  });
});
