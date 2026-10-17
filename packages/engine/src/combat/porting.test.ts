import { describe, expect, it } from 'vitest';
import { applyControl } from './control';
import { kit, makeCtx, sheet, unit } from './fixtures';
import { takeTurn } from './skills';
import { selectTargets } from './targeting';

/**
 * M9.6 engine primitives the faithful port needs: taunt as forced targeting
 * (not a skip), HP-basis secondary damage, shield-bypassing DoTs and a
 * per-unit basic-skill trigger rate.
 */

const team = { attackersPower: 100, defendersPower: 100 };

describe('M9.6 port primitives', () => {
  it('taunt redirects enemy-side targeting at the taunter', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1 });
    const d1 = unit({ key: 'd1', side: 'defenders', position: 4 });
    const d2 = unit({ key: 'd2', side: 'defenders', position: 5 });
    const ctx = makeCtx({ units: [a, d1, d2], deterministic: true });
    applyControl(ctx, d2, [a], { kind: 'taunt', chance: null });
    const picked = selectTargets(ctx, a, a.kit.skills.normal);
    expect(picked.map((u) => u.key)).toEqual(['d2']);
  });

  it('taunt is not a skip: the taunted unit still acts', () => {
    const a = unit({ key: 'a', side: 'attackers', position: 1, sheet: sheet({ pAtk: 200 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    applyControl(ctx, d, [a], { kind: 'taunt', chance: null });
    takeTurn(ctx, a, { bigRound: 1, team });
    expect(ctx.events.some((e) => e.type === 'action' && e.unit === 'a')).toBe(true);
    expect(d.hp).toBeLessThan(1000);
  });

  it('a damage rider can scale from the target HP', () => {
    const k = kit({
      skills: {
        normal: {
          effects: [{ op: 'damage', target: { side: 'enemy' }, basis: 'targetMaxHp', share: 0.1 }],
        },
      },
    });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet({ pAtk: 40 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    takeTurn(ctx, a, { bigRound: 1, team });
    // 40 direct + 10% of 1000 max HP
    expect(d.hp).toBe(860);
  });

  it('a DoT can be flagged as true damage and bypass shields', () => {
    const k = kit({
      skills: {
        normal: {
          effects: [
            {
              op: 'dot',
              target: { side: 'enemy' },
              dot: { share: 0.1, basis: 'targetMaxHp', turns: 2, trueDamage: true },
            },
          ],
        },
      },
    });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet({ pAtk: 1 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    d.shieldHp = 500;
    const ctx = makeCtx({ units: [a, d], deterministic: true });
    takeTurn(ctx, a, { bigRound: 1, team });
    d.shieldHp = 500; // refresh the shield so only the DoT tick can touch HP
    takeTurn(ctx, d, { bigRound: 1, team });
    expect(d.hp).toBeLessThan(1000);
    expect(d.shieldHp).toBe(500);
  });

  it('a talent basicRate overrides the global basic-skill rate', () => {
    const k = kit({ talents: { basicRate: 1 } });
    const a = unit({ key: 'a', side: 'attackers', position: 1, kit: k, sheet: sheet({ pAtk: 10 }) });
    const d = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    const ctx = makeCtx({ units: [a, d] }); // not deterministic: rng is live
    takeTurn(ctx, a, { bigRound: 1, team });
    const action = ctx.events.find((e) => e.type === 'action');
    expect(action && action.type === 'action' ? action.skill : null).toBe('basic');
  });
});
