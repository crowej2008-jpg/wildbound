import { describe, expect, it } from 'vitest';
import { applyEffects } from './effects';
import { evalCondition } from './conditions';
import { resolveSheet } from './stats';
import { kit, makeCtx, sheet, skill, spec, unit } from './fixtures';

/** M9.3: resource counters and level ladders. */

describe('M9.3 resource counters', () => {
  it('adds stacks up to the cap and consumes them', () => {
    const s = skill({
      slot: 'normal',
      effects: [
        { op: 'resource', target: { side: 'ally', rule: 'all' }, tag: 'frost', delta: 2, max: 3 },
        { op: 'resource', target: { side: 'ally', rule: 'all' }, tag: 'frost', delta: 2, max: 3 },
      ],
    });
    const a = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet() });
    const ctx = makeCtx({ units: [a], deterministic: true });
    applyEffects(ctx, a, s, []);
    expect(a.resources?.['frost']).toBe(3); // 2 + 2 capped at 3

    const consume = skill({
      slot: 'normal',
      effects: [{ op: 'resource', target: { side: 'ally', rule: 'all' }, tag: 'frost', consume: 1 }],
    });
    applyEffects(ctx, a, consume, []);
    expect(a.resources?.['frost']).toBe(2);
  });

  it('conditions read resource stacks', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet() });
    a.resources = { frost: 2 };
    const ctx = makeCtx({ units: [a], deterministic: true });
    expect(evalCondition({ selfStackAtLeast: { tag: 'frost', n: 2 } }, ctx, a)).toBe(true);
    expect(evalCondition({ selfStackAtLeast: { tag: 'frost', n: 3 } }, ctx, a)).toBe(false);
  });
});

describe('M9.3 level ladders', () => {
  it('talent stat mods resolve through scalesWithLevel', () => {
    const k = kit({
      talents: { statMods: [{ field: 'hp', mult: 1.1, scalesWithLevel: [[1, 1.1], [30, 1.5]] }] },
    });
    const at1 = resolveSheet({ id: 'a', name: 'a', position: 1, side: 'attackers', kit: k, sheet: sheet(), level: 1 });
    const at30 = resolveSheet({ id: 'a', name: 'a', position: 1, side: 'attackers', kit: k, sheet: sheet(), level: 30 });
    expect(at1.hp).toBe(Math.round(1000 * 1.1));
    expect(at30.hp).toBe(1500);
  });

  it('effect buff amounts resolve through the caster level', () => {
    const s = skill({
      slot: 'normal',
      effects: [
        {
          op: 'buff',
          target: { side: 'ally', rule: 'all' },
          buff: { tag: 'atkUp', kind: 'stat', field: 'pAtk', amount: 0.05, turns: 2, scalesWithLevel: [[1, 0.05], [30, 0.2]] },
        },
      ],
    });
    const a = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet() });
    a.level = 30;
    const ctx = makeCtx({ units: [a], deterministic: true });
    applyEffects(ctx, a, s, []);
    expect(a.buffs.find((b) => b.tag === 'atkUp')?.amount).toBeCloseTo(0.2);
  });

  it('a spec without a level defaults to level 1', () => {
    const k = kit({ talents: { statMods: [{ field: 'hp', mult: 1.1, scalesWithLevel: [[1, 1.1], [30, 1.5]] }] } });
    expect(resolveSheet(spec({ id: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet() })).hp).toBe(1100);
  });
});
