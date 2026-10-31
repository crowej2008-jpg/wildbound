import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import type { KitDef, SkillDef } from '@wildbound/engine';
import { loadKits } from './kit-loader';

/**
 * Faithfulness checks for the M9.6 kit port (docs/PORT-REPORT.md). These read
 * the shipped kits and assert the numbers that came straight off the owner's
 * skills sheet, so a regression in scripts/port-skills.mjs is caught here
 * rather than only by eye. The full residual/unparsed ledger lives in
 * docs/PORT-REPORT.md and docs/ASSUMPTIONS.md.
 */

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const kits: KitDef[] = loadKits(resolve(repoRoot, 'packages/content/kits'));
const byId = new Map(kits.map((k) => [k.id, k]));

function skill(id: string, slot: 'normal' | 'basic' | 'ult'): SkillDef {
  const kit = byId.get(id);
  if (!kit) throw new Error(`missing kit ${id}`);
  return kit.skills[slot];
}

describe('ported roster', () => {
  it('ships one kit per species id', () => {
    expect(kits.length).toBe(84);
    expect(new Set(kits.map((k) => k.id)).size).toBe(84);
  });

  it('gives every slot an attack line and a real target rule', () => {
    for (const kit of kits) {
      for (const slot of ['normal', 'basic', 'ult'] as const) {
        const s = kit.skills[slot];
        expect(s.rates.length, `${kit.id}.${slot}`).toBeGreaterThan(0);
        expect(Number.isFinite(s.rates[0]), `${kit.id}.${slot}`).toBe(true);
        expect(['P', 'S'], `${kit.id}.${slot}`).toContain(s.type);
      }
    }
  });
});

describe('faithful ports (numbers straight from the sheet)', () => {
  it('charizard: 135% P.ATK to the front row, plus the [Offer of Power] self package', () => {
    const ult = skill('charizard', 'ult');
    expect(ult.rates).toEqual([1.35]);
    expect(ult.rule).toBe('frontline');
    expect(ult.effects).toEqual(
      expect.arrayContaining([
        // "increases backline allies' Crit Chance by 10% for 2 turns"
        expect.objectContaining({
          op: 'buff',
          target: expect.objectContaining({ side: 'ally', rowFilter: 'back' }),
          buff: expect.objectContaining({ field: 'crit', amount: 0.1, turns: 2 }),
        }),
      ]),
    );
    // E3: "After using Ultimates, gain [Offer of Power]" — deducts 20% of current HP, regenerates
    // 100% Rage, +50% ultimate damage for a turn; cooldown 4 turns.
    const offer = byId.get('charizard')?.talents?.triggers?.find((t) => t.on === 'afterUlt' && t.cooldown === 4);
    expect(offer?.effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'damage', basis: 'casterCurrentHp', share: 0.2 }),
        expect.objectContaining({ op: 'rage', fill: true }),
        expect.objectContaining({ op: 'buff', buff: expect.objectContaining({ field: 'ultBoost', amount: 0.5 }) }),
      ]),
    );
  });

  it('snorlax: drains flat Rage points, not a percentage', () => {
    expect(skill('snorlax', 'normal').effects).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'rage', delta: -300 })]),
    );
    expect(skill('snorlax', 'basic').effects).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'rage', delta: -500 })]),
    );
  });

  it('ninetales: 60% S.ATK true-damage [Burning] for 4 turns', () => {
    const dot = skill('ninetales', 'ult').effects?.find((e) => e.op === 'dot');
    expect(dot).toMatchObject({
      op: 'dot',
      tag: 'burning',
      dot: { share: 0.6, basis: 'casterAtk', type: 'S', turns: 4, trueDamage: true },
    });
  });

  it('arceus: [sanction] marks tracked as a self resource', () => {
    expect(skill('arceus', 'normal').effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'resource', target: { rule: 'self' }, tag: 'sanction' }),
      ]),
    );
  });

  it('rayquaza: 30% of damage converted into self healing', () => {
    expect(skill('rayquaza', 'normal').lifesteal).toBe(0.3);
  });

  it('mimikyu: 15% chance to stun for 1 round', () => {
    expect(skill('mimikyu', 'ult').effects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ op: 'control', control: { kind: 'stun', chance: 0.15 } }),
      ]),
    );
  });

  it('wobbuffet: 160% S.ATK onto the opposing row', () => {
    const ult = skill('wobbuffet', 'ult');
    expect(ult.rates[0]).toBe(1.6);
    expect(ult.type).toBe('S');
    expect(ult.rule).toBe('row');
  });

  it('groudon: reward type follows the creature (a P.ATK talent line)', () => {
    // The sheet only says "damage"; the P.ATK talent line decides the type.
    expect(skill('groudon', 'normal').type).toBe('P');
    expect(skill('groudon', 'normal').rule).toBe('lowest_hp');
  });

  it('E3: Rage talents count shares of the 1,000-point bar', () => {
    // "Gain 1/8 additional Rage whenever you get hit" → 125 (was misread as 1 point).
    expect(byId.get('deoxys')?.talents?.rageOnHit).toBe(125);
    // "Normal attacks/basic skills generate 1/2 additional Rage; Ultimates generate 1/4 Rage".
    const triggers = byId.get('darkrai')?.talents?.triggers ?? [];
    expect(triggers).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ on: 'afterNormal', rage: 500 }),
        expect.objectContaining({ on: 'afterBasic', rage: 500 }),
        expect.objectContaining({ on: 'afterUlt', rage: 250 }),
      ]),
    );
  });

  it('E3: Talent 3 spellings — "Crit strength" is Crit Intensity and "Break" is Guard Break', () => {
    const mods = byId.get('zacian')?.talents?.statMods ?? [];
    expect(mods).toEqual(
      expect.arrayContaining([
        { field: 'critPower', add: 0.15 },
        { field: 'guardBreak', add: 0.51 },
      ]),
    );
  });

  it('E3: hand-ported one-offs (Lugia endures once; Shadow Mewtwo splashes 10% after its basic skill)', () => {
    const lugia = byId.get('lugia')?.talents?.triggers ?? [];
    expect(lugia.some((t) => t.effects?.some((e) => e.op === 'buff' && e.buff.kind === 'endure'))).toBe(true);
    const mewtwo = byId.get('shadow-mewtwo')?.talents?.triggers ?? [];
    expect(mewtwo.find((t) => t.on === 'afterBasic')?.effects).toEqual(
      expect.arrayContaining([expect.objectContaining({ op: 'splash', share: 0.1 })]),
    );
  });

  it("owner changes (2026-10-31): Snorlax +2% per 1% lost, Mimikyu's extra attacks gain Rage, Dialga fills the team's Rage", () => {
    const snorlax = byId.get('snorlax')?.talents?.damageMods?.find((m) => m.tag === 'snorlax-desperation');
    expect(snorlax).toMatchObject({ slot: 'ult', dmg: 2, scale: 'selfMissingHp' });
    expect(snorlax?.cap).toBeUndefined();
    const mimikyu = byId.get('mimikyu')?.talents?.triggers?.find((t) => t.on === 'afterBasic' && t.effects);
    expect(mimikyu?.effects?.[0]).toMatchObject({ op: 'extraAction', slot: 'roll' });
    expect(mimikyu?.effects?.[0]).not.toHaveProperty('noRage');
    const dialga = byId.get('dialga')?.talents?.triggers ?? [];
    expect(dialga).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ on: 'afterUlt', effects: [expect.objectContaining({ op: 'rage', target: { side: 'ally', rule: 'all' }, fill: true })] }),
      ]),
    );
  });
});
