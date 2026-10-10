import { describe, expect, it } from 'vitest';
import { channelHit, computeDamage } from './damage';
import { kit, lastEvent, makeCtx, sheet, unit } from './fixtures';
import { takeTurn } from './skills';
import type { BattleEvent } from './types';

/**
 * Statistical behaviour over 20,000 trials with stated tolerances (PROMPT
 * §6.9, docs/design/combat.md §Golden).
 */
describe('statistical behaviour (20k trials)', () => {
  it('crit rate converges on critSlope × (crit − critRes)', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ pAtk: 200, crit: 0.5 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 100000, critRes: 0.3 }) });
    const ctx = makeCtx({ units: [atk, def], seed: 42 });
    let crits = 0;
    const N = 20_000;
    for (let i = 0; i < N; i += 1) {
      const out = computeDamage(
        { attacker: atk, defender: def, skill: atk.kit.skills.normal, hitIndex: 0, team: { attackersPower: 100, defendersPower: 100 } },
        ctx,
      );
      if (out.crit) crits += 1;
    }
    const p = crits / N;
    expect(p).toBeGreaterThan(0.24 - 0.02);
    expect(p).toBeLessThan(0.24 + 0.02);
  });

  it('block rate converges on the piecewise value for block − guardBreak = 0.5', () => {
    const atk = unit({ key: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ pAtk: 200 }) });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 1e9, block: 0.5 }) });
    const ctx = makeCtx({ units: [atk, def], seed: 7 });
    let blocked = 0;
    const N = 20_000;
    for (let i = 0; i < N; i += 1) {
      const out = computeDamage(
        { attacker: atk, defender: def, skill: atk.kit.skills.normal, hitIndex: 0, team: { attackersPower: 100, defendersPower: 100 } },
        ctx,
      );
      if (out.blocked) blocked += 1;
    }
    const p = blocked / N;
    expect(p).toBeGreaterThan(0.5 - 0.02);
    expect(p).toBeLessThan(0.5 + 0.02);
  });

  it('basic-skill replacement converges on basicReplace (0.2)', () => {
    const atk = unit({
      key: 'a',
      side: 'attackers',
      position: 1,
      kit: kit({ class: 'guardian', skills: { normal: { rates: [0] }, basic: { rates: [0] }, ult: { rates: [0], rule: 'column' } } }),
      sheet: sheet({ hp: 1e9, pAtk: 0, spd: 1 }),
    });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit({ skills: { normal: { rates: [0] } } }), sheet: sheet({ hp: 1e9 }) });
    const ctx = makeCtx({ units: [atk, def], seed: 11 });
    let basics = 0;
    let normals = 0;
    const N = 20_000;
    for (let i = 0; i < N; i += 1) {
      atk.rage = 0;
      takeTurn(ctx, atk, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
      const action = lastEvent(ctx, 'action');
      if (action?.skill === 'basic') basics += 1;
      else if (action?.skill === 'normal') normals += 1;
    }
    const p = basics / (basics + normals);
    expect(p).toBeGreaterThan(0.2 - 0.02);
    expect(p).toBeLessThan(0.2 + 0.02);
  });

  it('tidewarden-style rage-cut chance converges on the declared 50%', () => {
    const atk = unit({
      key: 'a',
      side: 'attackers',
      position: 1,
      kit: kit(),
      sheet: sheet({ hp: 1e9, pAtk: 200 }),
    });
    const def = unit({
      key: 'd',
      side: 'defenders',
      position: 4,
      kit: kit({ talents: { rageCutChance: 0.5 } }),
      sheet: sheet({ hp: 1e9 }),
    });
    const ctx = makeCtx({ units: [atk, def], seed: 3 });
    let cuts = 0;
    const N = 20_000;
    for (let i = 0; i < N; i += 1) {
      atk.rage = 1000;
      const out = computeDamage(
        { attacker: atk, defender: def, skill: atk.kit.skills.normal, hitIndex: 0, team: { attackersPower: 100, defendersPower: 100 } },
        ctx,
      );
      channelHit(ctx, atk, def, out.dmg, {});
      if (atk.rage === 1000 - 125) cuts += 1;
    }
    const p = cuts / N;
    expect(p).toBeGreaterThan(0.5 - 0.03);
    expect(p).toBeLessThan(0.5 + 0.03);
  });

  it('a stated 60% control lands with probability close to the raw chance (no Res/Boost)', () => {
    const atk = unit({
      key: 'a',
      side: 'attackers',
      position: 1,
      kit: kit({ skills: { normal: { rates: [0], control: { kind: 'silence', chance: 0.6 } } } }),
      sheet: sheet({ hp: 1e9, pAtk: 0 }),
    });
    const def = unit({ key: 'd', side: 'defenders', position: 4, kit: kit({ skills: { normal: { rates: [0] } } }), sheet: sheet({ hp: 1e9 }) });
    const ctx = makeCtx({ units: [atk, def], seed: 21 });
    let landed = 0;
    let attempts = 0;
    const N = 20_000;
    for (let i = 0; i < N; i += 1) {
      atk.rage = 0;
      takeTurn(ctx, atk, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
      // defender's turn consumes the silence so it can be re-applied
      def.buffs = def.buffs.filter((b) => b.kind !== 'silence');
      const control = ctx.events.reduceRight<Extract<BattleEvent, { type: 'control' }> | undefined>(
        (found, e) => (found ?? (e.type === 'control' ? e : undefined)),
        undefined,
      );
      if (control && control.kind === 'silence') {
        attempts += 1;
        if (control.landed) landed += 1;
      }
    }
    const p = landed / attempts;
    expect(attempts).toBeGreaterThan(N * 0.9);
    expect(p).toBeGreaterThan(0.6 - 0.03);
    expect(p).toBeLessThan(0.6 + 0.03);
  });
});