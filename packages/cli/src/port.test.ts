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
        // "[Offer of Power] deducts 20% of current HP" — a cost the caster pays
        expect.objectContaining({ op: 'damage', target: { rule: 'self' }, share: 0.2 }),
        // "regenerates 100% Rage"
        expect.objectContaining({ op: 'rage', target: { rule: 'self' }, pct: 1 }),
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
        expect.objectContaining({ op: 'control', control: { kind: 'stun', chance: 0.15, turns: 1 } }),
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
});
