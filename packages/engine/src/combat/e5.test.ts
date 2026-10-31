import { describe, expect, it } from 'vitest';
import { applyCounterReflect } from './counter';
import { computeDamage } from './damage';
import { makeCtx, sheet, skill, unit } from './fixtures';

/** E5: combat numbers re-checked against kb/stats-and-combat.md. */

describe('E5 rules from the measured model', () => {
  it('a weaker team is cut on both sides (team Power, tpSymmetric)', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 4, sheet: sheet({ pAtk: 1000 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ pAtk: 1000 }) });
    const ctx = makeCtx({ units: [atk, def], deterministic: true });
    const s = skill({ slot: 'normal' });
    const even = computeDamage({ attacker: def, defender: atk, skill: s, hitIndex: 0, team: { attackersPower: 100, defendersPower: 100 } }, ctx).dmg;
    const weakDefenders = computeDamage({ attacker: def, defender: atk, skill: s, hitIndex: 0, team: { attackersPower: 100, defendersPower: 35 } }, ctx).dmg;
    expect(weakDefenders).toBeLessThan(even);
    expect(weakDefenders / even).toBeCloseTo(0.35 / ctx.settings.tpThreshold, 2);
  });

  it("Block INT belongs to the blocker: it cuts a blocked hit's kept share", () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 4, sheet: sheet({ pAtk: 1000, blockPower: 0.5 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, sheet: sheet({ block: 5, blockPower: 0.2 }) });
    const ctx = makeCtx({ units: [atk, def], seed: 3, settings: { blockIntScale: 1 } });
    const team = { attackersPower: 100, defendersPower: 100 };
    const blocked = computeDamage({ attacker: atk, defender: def, skill: skill({ slot: 'normal' }), hitIndex: 0, team }, ctx);
    expect(blocked.blocked).toBe(true);
    const det = makeCtx({ units: [atk, def], deterministic: true });
    const plain = computeDamage({ attacker: atk, defender: def, skill: skill({ slot: 'normal' }), hitIndex: 0, team }, det).dmg;
    // kept = blockKeep 0.8 − 1 × the defender's 0.2 = 0.6 (the attacker's own 0.5 plays no part)
    expect(blocked.dmg / plain).toBeCloseTo(0.6, 1);
  });

  it('the Counter reflect passes shields', () => {
    const w = unit({ key: 'w', side: 'attackers', position: 4, lost: 1000 });
    const t = unit({ key: 't', side: 'defenders', position: 4, sheet: sheet({ hp: 10000 }), shieldHp: 5000 });
    const ctx = makeCtx({ units: [w, t], deterministic: true });
    applyCounterReflect(ctx, w, skill({ slot: 'ult', counter: true }), [t], 2);
    expect(t.shieldHp).toBe(5000);
    expect(t.hp).toBe(10000 - 750);
  });
});
