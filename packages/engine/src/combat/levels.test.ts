import { describe, expect, it } from 'vitest';
import { computeDamage } from './damage';
import { kit, makeCtx, sheet, unit } from './fixtures';
import { applyPlateSkills, applyTrinketSkills } from './levels';
import type { KitDef, PlateSkillDef } from './types';

const mod = (tag: string): PlateSkillDef => ({ text: tag, damageMods: [{ tag, dmg: 0.1 }] });

describe('R6a / R6b plate and trinket skills', () => {
  it('stacks every plate tier at or below the stage', () => {
    const k: KitDef = { ...kit(), plate: { '6': mod('p6'), '12': mod('p12'), '18': mod('p18') } };
    expect(applyPlateSkills(k, 5).talents?.damageMods ?? []).toHaveLength(0);
    expect((applyPlateSkills(k, 12).talents?.damageMods ?? []).map((m) => m.tag)).toEqual(['p6', 'p12']);
  });

  it('applies only the highest trinket tier at or below the level', () => {
    const k: KitDef = { ...kit(), trinket: { '10': mod('t10'), '20': mod('t20'), '30': mod('t30'), '40': mod('t40') } };
    expect(applyTrinketSkills(k, 9).talents?.damageMods ?? []).toHaveLength(0);
    expect((applyTrinketSkills(k, 25).talents?.damageMods ?? []).map((m) => m.tag)).toEqual(['t20']);
    expect((applyTrinketSkills(k, 40).talents?.damageMods ?? []).map((m) => m.tag)).toEqual(['t40']);
  });

  it('a damage mod can add Crit and Crit INT to the hit', () => {
    const base = kit();
    const withMod: KitDef = { ...base, talents: { damageMods: [{ tag: 'c', crit: 5, critPower: 1 }] } };
    const run = (k: KitDef) => {
      const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet({ pAtk: 200 }) });
      const d = unit({ key: 'd', side: 'defenders', position: 4, kit: base, sheet: sheet({ hp: 100000 }) });
      const ctx = makeCtx({ units: [a, d], seed: 7, settings: { critFloor: 0 } });
      return computeDamage({ attacker: a, defender: d, skill: k.skills.normal, hitIndex: 0, team: { attackersPower: 100, defendersPower: 100 } }, ctx);
    };
    const hit = run(withMod);
    expect(hit.crit).toBe(true);
    expect(hit.dmg).toBeGreaterThan(run(base).dmg);
  });
});
