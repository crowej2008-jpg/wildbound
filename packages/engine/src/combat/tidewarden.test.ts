import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { countEvents, kit, makeCtx, sheet, spec, unit } from './fixtures';
import { takeTurn } from './skills';
import type { KitDef, SpecInput } from './types';

/**
 * Appendix B of PROMPT.md — the `tidewarden` example kit (counter-style
 * Guardian) plus its required tests: reflect math, safeguard immunity windows,
 * ally-shelter stacks, buff refresh/never-stack, and the 50% Rage-cut chance
 * (statistical, in statistical.test.ts).
 */
const tidewardenKit: KitDef = {
  id: 'tidewarden',
  name: 'Tidewarden',
  faction: 'tide',
  class: 'guardian',
  tier: 'mythic',
  skills: {
    normal: {
      slot: 'normal',
      type: 'S',
      rates: [1.0],
      rule: 'column',
      selfBuffs: [{ tag: 'ripple', kind: 'stat', field: 'dmgRdct', amount: 0.15, turns: 2 }],
    },
    basic: {
      slot: 'basic',
      type: 'S',
      rates: [1.2],
      rule: 'column',
      selfBuffs: [{ tag: 'surge', kind: 'stat', field: 'dmgRdct', amount: 0.15, turns: 2 }],
    },
    ult: { slot: 'ult', type: 'S', rates: [1.6], rule: 'row', counter: true },
  },
  counterShare: 0.75,
  talents: {
    statMods: [
      { field: 'hp', mult: 1.25 },
      { field: 'sAtk', mult: 1.25 },
      { field: 'crit', add: 0.06 },
      { field: 'critRes', add: 0.38 },
      { field: 'critPower', add: 0.06 },
      { field: 'block', add: 0.09 },
      { field: 'blockPower', add: 0.09 },
      { field: 'guardBreak', add: 0.08 },
    ],
    rageOnHit: 125,
    rageCutChance: 0.5,
    safeguard: { active: 3, cycle: 6 },
    turnHooks: ['allyShelterStack'],
  },
  hooksConfig: { allyShelterStack: { field: 'dmgRdct', amount: 0.03, cap: 4 } },
};

function tw(opts: { side: 'attackers' | 'defenders'; position: number; rage?: number; lost?: number }): ReturnType<typeof unit> {
  return unit({ key: opts.side === 'attackers' ? `tw-a${opts.position}` : `tw-d${opts.position}`, side: opts.side, position: opts.position, kit: tidewardenKit, sheet: sheet({ hp: 4000, sAtk: 300, spd: 100, crit: 0.06, critRes: 0.38, critPower: 0.06, block: 0.09, blockPower: 0.09, guardBreak: 0.08 }), rage: opts.rage ?? 0, lost: opts.lost ?? 0 });
}

const foe = (key: string, side: 'attackers' | 'defenders', position: number): ReturnType<typeof unit> =>
  unit({ key, side, position, kit: kit(), sheet: sheet({ hp: 5000, pAtk: 100, sAtk: 100, spd: 90 }) });

describe('tidewarden', () => {
  it('ult counter reflects floor(0.75 × previous-round loss) to every row target, none in round 1', () => {
    const caster = tw({ side: 'defenders', position: 1, rage: 1000, lost: 400 });
    const a1 = foe('a4', 'attackers', 4);
    const a2 = foe('a5', 'attackers', 5);
    const a3 = foe('a6', 'attackers', 6);
    const ctx = makeCtx({ units: [caster, a1, a2, a3], deterministic: true });

    takeTurn(ctx, caster, { bigRound: 2, team: { attackersPower: 100, defendersPower: 100 } });
    const reflects = ctx.events.filter((e) => e.type === 'reflect');
    expect(reflects).toHaveLength(3);
    for (const r of reflects) expect(r.dmg).toBe(Math.floor(0.75 * 400));

    // round 1 → no reflect fires
    const caster2 = tw({ side: 'defenders', position: 1, rage: 1000, lost: 400 });
    const ctx2 = makeCtx({ units: [caster2, foe('a4', 'attackers', 4), foe('a5', 'attackers', 5), foe('a6', 'attackers', 6)], deterministic: true });
    takeTurn(ctx2, caster2, { bigRound: 1, team: { attackersPower: 100, defendersPower: 100 } });
    expect(countEvents(ctx2, 'reflect')).toBe(0);
    expect(countEvents(ctx2, 'hit')).toBe(3);
  });

  it('safeguard immunity windows are rounds 1-3, 7-9 and 13-15', () => {
    // every stunner slot carries a guaranteed stun so it attempts every round
    const stunnerKit = (): KitDef =>
      kit({
        class: 'striker',
        skills: {
          normal: { rates: [0], control: { kind: 'stun', chance: null } },
          basic: { rates: [0], control: { kind: 'stun', chance: null } },
          ult: { rates: [0], rule: 'column', control: { kind: 'stun', chance: null } },
        },
      });
    const stunner = (id: string, side: 'attackers' | 'defenders', position: number): SpecInput =>
      spec({ id, side, position, kit: stunnerKit(), sheet: sheet({ hp: 5000, pAtk: 0, spd: 50 }) });
    const r = runBattle({
      attackers: [stunner('a', 'attackers', 1)],
      defenders: [genericTwSpec()],
      seed: 1,
      deterministic: true,
    });
    const immunities = new Set<number>();
    const landed = new Set<number>();
    let round = 1;
    for (const e of r.events) {
      if (e.type === 'roundStart') { round = e.bigRound; continue; }
      if (e.type === 'immunity') immunities.add(round);
      if (e.type === 'control' && e.landed) landed.add(round);
    }
    expect([...immunities].sort((a, b) => a - b)).toEqual([1, 2, 3, 7, 8, 9, 13, 14, 15]);
    expect([...landed].sort((a, b) => a - b)).toEqual([4, 5, 6, 10, 11, 12]);
  });

  it('allyShelterStack hooks cap at 4 stacks per round', () => {
    const caster = tw({ side: 'attackers', position: 1, rage: 0 });
    const ally = foe('a2', 'attackers', 2);
    const ctx = makeCtx({ units: [caster, ally], deterministic: true });
    for (let i = 0; i < 8; i += 1) {
      caster.rage = 0;
      ctx.round = i + 1;
      takeTurn(ctx, caster, { bigRound: i + 1, team: { attackersPower: 100, defendersPower: 100 } });
    }
    const stacks = ally.buffs.filter((b) => b.kind === 'stat' && b.field === 'dmgRdct' && b.tag.startsWith('allyShelter'));
    expect(stacks.length).toBe(4);
  });

  it('self-buffs refresh and never stack', () => {
    const caster = tw({ side: 'attackers', position: 1, rage: 0 });
    const ctx = makeCtx({ units: [caster], deterministic: true });
    for (let i = 0; i < 4; i += 1) {
      caster.rage = 0;
      takeTurn(ctx, caster, { bigRound: i + 1, team: { attackersPower: 100, defendersPower: 100 } });
    }
    expect(caster.buffs.filter((b) => b.tag === 'ripple')).toHaveLength(1);
    expect(caster.buffs.filter((b) => b.tag === 'surge')).toHaveLength(0);
  });
});

function genericTwSpec(): SpecInput {
  return spec({ id: 'tw', side: 'defenders', position: 4, kit: tidewardenKit, sheet: sheet({ hp: 4000, sAtk: 300, spd: 100, crit: 0.06, critRes: 0.38, critPower: 0.06, block: 0.09, blockPower: 0.09, guardBreak: 0.08 }) });
}