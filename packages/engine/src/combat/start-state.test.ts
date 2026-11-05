import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { kit, sheet, spec } from './fixtures';

/** M13.6: a unit can start a fight part-damaged and with Rage (Misty Woods carries both between fights). */
describe('starting HP and Rage', () => {
  it('starts a unit at the given HP fraction and Rage, and the result keeps max HP', () => {
    const attacker = { ...spec({ id: 'a', side: 'attackers', position: 1, kit: kit(), sheet: sheet({ hp: 10_000 }) }), startHpFraction: 0.25, startRage: 400 };
    const defender = spec({ id: 'd', side: 'defenders', position: 4, kit: kit(), sheet: sheet({ hp: 10_000 }) });
    const result = runBattle({ attackers: [attacker], defenders: [defender], seed: 7, deterministic: true, settings: { maxRounds: 1 } });
    const a = result.units.find((u) => u.side === 'attackers')!;
    expect(a.maxHp).toBe(10_000);
    expect(a.hp).toBeLessThanOrEqual(2_500);
    const first = result.events.find((e) => e.type === 'rageChange' && e.unit === 'attackers:1');
    if (first && first.type === 'rageChange') expect(first.rage - first.delta).toBe(400);
  });

  it('a fraction above 1 is clamped to full HP', () => {
    const attacker = { ...spec({ id: 'a', side: 'attackers', position: 1, sheet: sheet({ hp: 1_000 }) }), startHpFraction: 3 };
    const defender = spec({ id: 'd', side: 'defenders', position: 4, sheet: sheet({ hp: 1 }) });
    const result = runBattle({ attackers: [attacker], defenders: [defender], seed: 1, deterministic: true });
    expect(result.units.find((u) => u.side === 'attackers')!.hp).toBeLessThanOrEqual(1_000);
  });
});
