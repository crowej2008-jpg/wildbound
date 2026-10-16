import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { kit, sheet, spec } from './fixtures';
import type { BattleResult, KitDef } from './types';

const weakKit = (): KitDef =>
  kit({ skills: { normal: { rates: [0] }, basic: { rates: [0] }, ult: { rates: [0], rule: 'row' } } });
const strongKit = (): KitDef =>
  kit({
    class: 'striker',
    skills: { normal: { rates: [2.0] }, basic: { rates: [2.0] }, ult: { rates: [3.0], rule: 'all' } },
  });

function fight(atk: ReturnType<typeof spec>[], def: ReturnType<typeof spec>[], opts: { seed?: number; deterministic?: boolean; maxRounds?: number } = {}): BattleResult {
  return runBattle({ attackers: atk, defenders: def, seed: opts.seed ?? 42, deterministic: opts.deterministic, settings: opts.maxRounds ? { maxRounds: opts.maxRounds } : undefined });
}

describe('runBattle', () => {
  it('overwhelming attackers win before the time-out', () => {
    const attackers = [spec({ id: 'a', side: 'attackers', position: 1, kit: strongKit(), sheet: sheet({ hp: 5000, pAtk: 500, spd: 200 }) })];
    const defenders = [spec({ id: 'd', side: 'defenders', position: 4, kit: weakKit(), sheet: sheet({ hp: 800 }) })];
    const r = fight(attackers, defenders, { deterministic: true });
    expect(r.winner).toBe('attackers');
    const finish = r.events[r.events.length - 1]!;
    expect(finish.type).toBe('result');
    const survivor = r.units.find((u) => u.side === 'defenders' && u.alive);
    expect(survivor).toBeUndefined();
  });

  it('a slow attrition fight times out to the defenders at maxRounds', () => {
    const attackers = [spec({ id: 'a', side: 'attackers', position: 1, kit: weakKit(), sheet: sheet({ hp: 5000, pAtk: 50, spd: 200 }) })];
    const defenders = [spec({ id: 'd', side: 'defenders', position: 4, kit: weakKit(), sheet: sheet({ hp: 200000 }) })];
    const r = fight(attackers, defenders, { deterministic: true });
    expect(r.winner).toBe('defenders');
    expect(r.rounds).toBe(15);
  });

  it('is fully reproducible for the same seed and squads (deterministic)', () => {
    const attackers = [spec({ id: 'a', side: 'attackers', position: 1, kit: strongKit(), sheet: sheet({ hp: 5000, pAtk: 500, spd: 200 }) })];
    const defenders = [spec({ id: 'd', side: 'defenders', position: 4, kit: weakKit(), sheet: sheet({ hp: 4000 }) })];
    const r1 = fight(attackers, defenders, { deterministic: true, seed: 7 });
    const r2 = fight(attackers, defenders, { deterministic: true, seed: 7 });
    expect(JSON.stringify(r1.events)).toBe(JSON.stringify(r2.events));
    expect(r1.winner).toBe(r2.winner);
    expect(r1.damageDealt).toEqual(r2.damageDealt);
  });

  it('ties act in attacker-side order (attackers first)', () => {
    const atkKit = weakKit();
    const defKit = weakKit();
    const attackers = [spec({ id: 'a', side: 'attackers', position: 1, kit: atkKit, sheet: sheet({ hp: 5000, pAtk: 20, spd: 100 }) })];
    const defenders = [spec({ id: 'd', side: 'defenders', position: 4, kit: defKit, sheet: sheet({ hp: 5000 }) })];
    const r = runBattle({ attackers, defenders, seed: 1, deterministic: true });
    // both same base speed; the round-1 first action slot is the attacker's
    const round1Actions = r.events.filter((e) => e.type === 'action');
    expect(round1Actions[0]).toMatchObject({ unit: 'attackers:1', skill: 'normal' });
  });

  it('a defender wipe redeems mid-round even before maxRounds', () => {
    const attackers = [
      spec({ id: 'a', side: 'attackers', position: 1, kit: strongKit(), sheet: sheet({ hp: 5000, pAtk: 800, spd: 300 }) }),
      spec({ id: 'b', side: 'attackers', position: 2, kit: strongKit(), sheet: sheet({ hp: 5000, pAtk: 800, spd: 300 }) }),
    ];
    const defenders = [spec({ id: 'd', side: 'defenders', position: 4, kit: weakKit(), sheet: sheet({ hp: 300 }) })];
    const r = fight(attackers, defenders, { deterministic: true, maxRounds: 15 });
    expect(r.winner).toBe('attackers');
    expect(r.rounds).toBeLessThan(15);
    expect(r.rounds).toBe(1);
  });

  it('M8 noUltimate: a full-rage striker never casts its ultimate', () => {
    const attackers = [spec({ id: 'a', side: 'attackers', position: 1, kit: strongKit(), sheet: sheet({ hp: 5000, pAtk: 500, spd: 300 }) })];
    const defenders = [spec({ id: 'd', side: 'defenders', position: 4, kit: weakKit(), sheet: sheet({ hp: 4000 }) })];
    const withU = runBattle({ attackers, defenders, seed: 3, deterministic: true });
    const noU = runBattle({ attackers, defenders, seed: 3, deterministic: true, rules: { noUltimate: true } });
    expect(withU.events.some((e) => e.type === 'action' && e.skill === 'ult')).toBe(true);
    expect(noU.events.some((e) => e.type === 'action' && e.skill === 'ult')).toBe(false);
  });

  it('M8 survivalRounds: the attackers win a time-out if any survives', () => {
    // A tanky, harmless attacker vs an immortal defender: the loop times out.
    const attackers = [spec({ id: 'a', side: 'attackers', position: 1, kit: weakKit(), sheet: sheet({ hp: 5000, pAtk: 50, spd: 200 }) })];
    const defenders = [spec({ id: 'd', side: 'defenders', position: 4, kit: weakKit(), sheet: sheet({ hp: 200000 }) })];
    const normal = runBattle({ attackers, defenders, seed: 5, deterministic: true });
    expect(normal.winner).toBe('defenders');
    const survival = runBattle({ attackers, defenders, seed: 5, deterministic: true, rules: { survivalRounds: 5 } });
    expect(survival.winner).toBe('attackers');
    expect(survival.rounds).toBe(5);
  });

  it('M8 survivalRounds still loses when the attackers are wiped', () => {
    const attackers = [spec({ id: 'a', side: 'attackers', position: 1, kit: weakKit(), sheet: sheet({ hp: 100, spd: 1 }) })];
    const defenders = [spec({ id: 'd', side: 'defenders', position: 4, kit: strongKit(), sheet: sheet({ hp: 5000, pAtk: 900, spd: 300 }) })];
    const survival = runBattle({ attackers, defenders, seed: 5, deterministic: true, rules: { survivalRounds: 5 } });
    expect(survival.winner).toBe('defenders');
  });
});