import { describe, expect, it } from 'vitest';
import { computeDamage } from './damage';
import { kit, makeCtx, sheet, unit } from './fixtures';
import type { Combatant } from './types';

/**
 * M9.5: the DEF switch. DEF is inert by default (the measured model); with
 * `defendersUseDef` on, P.DEF/S.DEF cut damage on `def / (def + defK)`.
 */

const team = { attackersPower: 100, defendersPower: 100 };

function attacker(): Combatant {
  return unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet({ pAtk: 200, sAtk: 200 }) });
}

function dmg(defender: Combatant, slot: 'normal' | 'basic' | 'ult', useDef: boolean, sType = false): number {
  const k = kit({ skills: { [slot]: sType ? { type: 'S' } : {} } });
  const a = attacker();
  a.kit = k;
  const ctx = makeCtx({ units: [a, defender], deterministic: true, settings: { defendersUseDef: useDef, defK: 1000 } });
  return computeDamage({ attacker: a, defender, skill: k.skills[slot], hitIndex: 0, team }, ctx).dmg;
}

describe('M9.5 DEF switch', () => {
  it('is inert while defendersUseDef is off', () => {
    const soft = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000, pDef: 0 }) });
    const hard = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000, pDef: 5000 }) });
    expect(dmg(soft, 'normal', false)).toBe(200);
    expect(dmg(hard, 'normal', false)).toBe(200);
  });

  it('halves damage at DEF == defK when switched on', () => {
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000, pDef: 1000, sDef: 1000 }) });
    expect(dmg(d, 'normal', true)).toBe(100);
    expect(dmg(d, 'basic', true, true)).toBe(110); // 200 × basic rate 1.1 × 0.5
  });

  it('reads S.DEF for S-type skills', () => {
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000, pDef: 0, sDef: 1000 }) });
    expect(dmg(d, 'normal', true)).toBe(200); // P skill vs 0 P.DEF
    expect(dmg(d, 'normal', true, true)).toBe(100); // S skill vs 1000 S.DEF
  });

  it('lets ignoreDefense cut through the defender DEF', () => {
    const k = kit({ skills: { normal: { ignoreDefense: 0.5 } } });
    const a = attacker();
    a.kit = k;
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000, pDef: 1000 }) });
    const ctx = makeCtx({ units: [a], deterministic: true, settings: { defendersUseDef: true, defK: 1000 } });
    // effective DEF 500 → ×(1 − 500/1500) = 0.667
    expect(computeDamage({ attacker: a, defender: d, skill: k.skills.normal, hitIndex: 0, team }, ctx).dmg).toBe(133);
  });

  it('honours a live DEF debuff', () => {
    const k = kit({ skills: { normal: { targetDebuffs: [{ tag: 'shred', kind: 'stat', field: 'pDef', amount: -1000 }] } } });
    const a = attacker();
    a.kit = k;
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000, pDef: 1000 }) });
    d.buffs.push({ tag: 'shred', kind: 'stat', source: 'x', field: 'pDef', amount: -1000, turns: 2 });
    const ctx = makeCtx({ units: [a], deterministic: true, settings: { defendersUseDef: true, defK: 1000 } });
    expect(computeDamage({ attacker: a, defender: d, skill: k.skills.normal, hitIndex: 0, team }, ctx).dmg).toBe(200);
  });
});
