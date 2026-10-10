import { describe, expect, it } from 'vitest';
import { array, assert, constant, constantFrom, double, integer, oneof, property, record, type Arbitrary } from 'fast-check';
import { runBattle } from './battle';
import { kit, sheet } from './fixtures';
import type { KitDef, SheetInput, SpecInput } from './types';

/**
 * Battle invariants over arbitrary squads and seeds (fast-check):
 * termination, wipe/winner consistency, stat ranges, and the deterministic
 * property that crit/block never fire in replay mode.
 */

interface FrameSpec {
  position: number;
  kit: KitDef;
  sheet: Partial<SheetInput>;
  power: number;
}

const frame: Arbitrary<Partial<SheetInput>> = record({
  pAtk: integer({ min: 50, max: 1200 }),
  sAtk: integer({ min: 50, max: 1200 }),
  spd: integer({ min: 40, max: 240 }),
  crit: double({ min: 0, max: 0.6 }),
  critRes: double({ min: 0, max: 0.6 }),
  block: double({ min: 0, max: 0.8 }),
  guardBreak: double({ min: 0, max: 0.6 }),
});

const aKit: Arbitrary<KitDef> = oneof(
  constant(kit({ class: 'striker', skills: { normal: { rates: [1.0] }, basic: { rates: [1.2] }, ult: { rates: [1.6], rule: 'row' } } })),
  constant(kit({ class: 'guardian', skills: { normal: { rates: [1.0] }, basic: { rates: [1.1] }, ult: { rates: [1.4], rule: 'row', counter: true } } })),
  constant(kit({ class: 'adept', skills: { normal: { rates: [0.8] }, basic: { rates: [1.0] }, ult: { rates: [1.2], rule: 'all' } } })),
);

const specArbitrary: Arbitrary<FrameSpec[]> = array(
  record({
    position: constantFrom(1, 2, 3, 4, 5, 6),
    kit: aKit,
    sheet: frame,
    power: integer({ min: 50, max: 200 }),
  }),
  { minLength: 1, maxLength: 3 },
);

function team(side: 'attackers' | 'defenders', specs: FrameSpec[]): SpecInput[] {
  return specs.map((s) => ({
    id: `${side}${s.position}`,
    name: `${side}${s.position}`,
    position: s.position,
    side,
    kit: s.kit,
    sheet: sheet(s.sheet),
    power: s.power,
  }));
}

describe('runBattle property invariants', () => {
  it('terminates, reports a winner, and keeps every stat in range', () => {
    assert(
      property(
        integer({ min: 1, max: 2 ** 31 - 1 }),
        specArbitrary,
        specArbitrary,
        (seed, atk, def) => {
          const r = runBattle({ attackers: team('attackers', atk), defenders: team('defenders', def), seed });
          expect(['attackers', 'defenders']).toContain(r.winner);
          expect(r.rounds).toBeGreaterThanOrEqual(1);
          expect(r.rounds).toBeLessThanOrEqual(15);
          const starts = r.events.filter((e) => e.type === 'roundStart').length;
          expect(starts).toBe(r.rounds);
          expect(r.events[r.events.length - 1]!.type).toBe('result');
          for (const u of r.units) {
            expect(u.hp).toBeGreaterThanOrEqual(0);
            expect(u.hp).toBeLessThanOrEqual(u.maxHp);
          }
        },
      ),
      { numRuns: 60 },
    );
  });

  it('the winner matches the surviving side or the time-out', () => {
    assert(
      property(
        integer({ min: 1, max: 2 ** 31 - 1 }),
        specArbitrary,
        specArbitrary,
        (seed, atk, def) => {
          const r = runBattle({ attackers: team('attackers', atk), defenders: team('defenders', def), seed });
          const alive = (side: 'attackers' | 'defenders') => r.units.some((u) => u.side === side && u.alive);
          if (r.winner === 'attackers') {
            expect(alive('defenders')).toBe(false);
          } else {
            // defenders win on time-out or by wiping the attackers
            expect(r.rounds === 15 || !alive('attackers')).toBe(true);
          }
        },
      ),
      { numRuns: 60 },
    );
  });

  it('deterministic replay never emits crits or blocks', () => {
    assert(
      property(
        integer({ min: 1, max: 2 ** 31 - 1 }),
        specArbitrary,
        specArbitrary,
        (seed, atk, def) => {
          const r = runBattle({
            attackers: team('attackers', atk),
            defenders: team('defenders', def),
            seed,
            deterministic: true,
          });
          for (const e of r.events) {
            if (e.type !== 'hit') continue;
            expect(e.crit).toBe(false);
            expect(e.blocked).toBe(false);
          }
        },
      ),
      { numRuns: 40 },
    );
  });
});
