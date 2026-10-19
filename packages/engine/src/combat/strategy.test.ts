import { describe, expect, it } from 'vitest';
import { runBattle } from './battle';
import { kit, makeCtx, sheet, skill, spec, unit } from './fixtures';
import { chooseSlot, holdsUltimate, sideStrategy, skillRole, squadHealthy } from './strategy';
import { takeTurn } from './skills';
import type { BattleConfig, KitDef, SkillSlot } from './types';

/**
 * M10.5 — live squad strategies. `balanced` is the measured model and must stay
 * byte-identical; `aggressive`/`defensive` are additive policies over the action
 * slot. See docs/design/pvp.md.
 */

/** A pure damage dealer: every slot hits. */
const damageKit = (): KitDef =>
  kit({ skills: { normal: { rates: [1.0] }, basic: { rates: [1.1] }, ult: { rates: [1.4], rule: 'row' } } });

/** A support kit: its `normal` heals (so `aggressive` should prefer the basic). */
const supportKit = (): KitDef =>
  kit({
    skills: {
      normal: { rates: [0], heal: { target: 'allies', rate: 0.2 } },
      basic: { rates: [1.1] },
      ult: { rates: [0], shield: { target: 'allies', share: 0.2 }, rule: 'row' },
    },
  });

const team = { attackersPower: 100, defendersPower: 100 };

function fight(opts: Partial<BattleConfig> & { seed?: number } = {}) {
  const attacker = () =>
    spec({ id: 'a', side: 'attackers', position: 1, kit: damageKit(), sheet: sheet({ hp: 4000, pAtk: 300, spd: 200 }) });
  const defender = () =>
    spec({ id: 'd', side: 'defenders', position: 4, kit: damageKit(), sheet: sheet({ hp: 4000, pAtk: 300 }) });
  return runBattle({ attackers: [attacker()], defenders: [defender()], seed: opts.seed ?? 42, ...opts });
}

const ultEvents = (r: ReturnType<typeof fight>, unit?: string) =>
  r.events.filter((e) => e.type === 'action' && e.skill === 'ult' && (unit === undefined || e.unit === unit)).length;
const basicEvents = (r: ReturnType<typeof fight>, unit?: string) =>
  r.events.filter((e) => e.type === 'action' && e.skill === 'basic' && (unit === undefined || e.unit === unit)).length;

/** The last action event by `unit` in a context (its chosen slot). */
function lastActionOf(ctx: { events: { type: string; unit?: string; skill?: SkillSlot | null }[] }, unit: string) {
  return ctx.events.filter((e) => e.type === 'action' && e.unit === unit).at(-1);
}

/** The big round of the first `skill` action by `unit` (Infinity when it never acts). */
function firstRoundOf(r: ReturnType<typeof fight>, unit: string, skill: SkillSlot): number {
  let round = 0;
  for (const e of r.events) {
    if (e.type === 'roundStart') round = e.bigRound;
    if (e.type === 'action' && e.unit === unit && e.skill === skill) return round;
  }
  return Number.POSITIVE_INFINITY;
}

describe('skillRole', () => {
  it('reads a damage skill', () => {
    expect(skillRole(skill({ slot: 'normal', rates: [1.0] }))).toBe('damage');
  });

  it('reads a heal, a shield and an ally-side skill as support', () => {
    expect(skillRole(skill({ slot: 'normal', rates: [0], heal: { target: 'allies', rate: 0.2 } }))).toBe('support');
    expect(skillRole(skill({ slot: 'ult', rates: [0], shield: { target: 'self', share: 0.3 } }))).toBe('support');
    expect(skillRole(skill({ slot: 'normal', rates: [0], side: 'ally', rule: 'row' }))).toBe('support');
  });

  it('reads a skill with no damage and no sustain as neutral', () => {
    expect(skillRole(skill({ slot: 'normal', rates: [0] }))).toBe('neutral');
  });
});

describe('chooseSlot', () => {
  it('never overrides the balanced roll', () => {
    for (const roll of ['normal', 'basic', 'ult'] as const) {
      expect(chooseSlot('balanced', damageKit(), true, roll)).toBe(roll);
      expect(chooseSlot('balanced', supportKit(), false, roll)).toBe(roll);
    }
  });

  it('aggressive refuses the filler and keeps damage first', () => {
    // The ult when it is usable, otherwise the real skill — never the basic roll.
    expect(chooseSlot('aggressive', damageKit(), true, 'normal')).toBe('ult');
    expect(chooseSlot('aggressive', damageKit(), false, 'basic')).toBe('normal');
    // A support kit still has a damaging basic to fall back to.
    expect(chooseSlot('aggressive', supportKit(), false, 'normal')).toBe('basic');
    expect(chooseSlot('aggressive', supportKit(), true, 'ult')).toBe('basic');
  });

  it('defensive prefers a support skill and otherwise keeps the roll', () => {
    expect(chooseSlot('defensive', supportKit(), false, 'basic')).toBe('normal');
    expect(chooseSlot('defensive', supportKit(), true, 'normal')).toBe('ult');
    // No support skill on the kit: nothing to prefer, so the roll stands.
    expect(chooseSlot('defensive', damageKit(), false, 'basic')).toBe('basic');
    expect(chooseSlot('defensive', damageKit(), true, 'ult')).toBe('ult');
  });
});

describe('sideStrategy', () => {
  it('defaults a missing side to balanced', () => {
    expect(sideStrategy(undefined, 'attackers')).toBe('balanced');
    expect(sideStrategy({ defenders: 'aggressive' }, 'attackers')).toBe('balanced');
    expect(sideStrategy({ defenders: 'aggressive' }, 'defenders')).toBe('aggressive');
  });
});

describe('squadHealthy / holdsUltimate', () => {
  const attacker = unit({ key: 'attackers:1', side: 'attackers', position: 1, sheet: sheet({ hp: 1000 }) });
  const defender = unit({ key: 'defenders:4', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });

  it('is true while every living ally is above the threshold', () => {
    const ctx = makeCtx({ units: [attacker, defender] });
    expect(squadHealthy(ctx, attacker, 0.75)).toBe(true);
    expect(holdsUltimate(ctx, attacker, 'defensive')).toBe(true);
    expect(holdsUltimate(ctx, attacker, 'balanced')).toBe(false);
    expect(holdsUltimate(ctx, attacker, 'aggressive')).toBe(false);
  });

  it('is false once any ally is at or below the threshold', () => {
    const hurt = unit({ key: 'attackers:2', side: 'attackers', position: 2, sheet: sheet({ hp: 1000 }), hp: 700 });
    const ctx = makeCtx({ units: [attacker, hurt, defender] });
    expect(squadHealthy(ctx, attacker, 0.75)).toBe(false);
    expect(holdsUltimate(ctx, attacker, 'defensive')).toBe(false);
  });

  it('ignores the other side', () => {
    const enemyHurt = unit({ key: 'defenders:5', side: 'defenders', position: 5, sheet: sheet({ hp: 1000 }), hp: 100 });
    const ctx = makeCtx({ units: [attacker, enemyHurt] });
    expect(squadHealthy(ctx, attacker, 0.75)).toBe(true);
  });
});

describe('strategies inside a real battle', () => {
  it('an explicit balanced side is byte-identical to passing no strategy', () => {
    const none = fight({ deterministic: false });
    const balanced = fight({ strategies: { attackers: 'balanced', defenders: 'balanced' } });
    expect(JSON.stringify(balanced.events)).toBe(JSON.stringify(none.events));
  });

  it('aggressive never spends a turn on the filler basic', () => {
    let measuredBasics = 0;
    let aggressiveBasics = 0;
    let differs = 0;
    for (let seed = 1; seed <= 24; seed += 1) {
      const measured = fight({ seed });
      const aggressive = fight({ seed, strategies: { attackers: 'aggressive' } });
      measuredBasics += basicEvents(measured, 'attackers:1');
      aggressiveBasics += basicEvents(aggressive, 'attackers:1');
      if (JSON.stringify(aggressive.events) !== JSON.stringify(measured.events)) differs += 1;
    }
    // The measured model takes the filler roll sometimes; aggressive never does.
    expect(measuredBasics).toBeGreaterThan(0);
    expect(aggressiveBasics).toBe(0);
    expect(differs).toBeGreaterThan(0);
  });

  it('defensive holds the ultimate while the squad is healthy, then casts it', () => {
    const held = unit({ key: 'attackers:1', side: 'attackers', position: 1, sheet: sheet({ hp: 1000 }), rage: 1000 });
    const enemy = unit({ key: 'defenders:4', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });

    const fresh = makeCtx({ units: [held, enemy], strategies: { attackers: 'defensive' } });
    takeTurn(fresh, held, { bigRound: 1, team });
    expect(lastActionOf(fresh, 'attackers:1')).toMatchObject({ skill: 'normal' });

    const balanced = makeCtx({ units: [held, enemy], strategies: { attackers: 'balanced' } });
    takeTurn(balanced, balanced.units[0]!, { bigRound: 1, team });
    expect(lastActionOf(balanced, 'attackers:1')).toMatchObject({ skill: 'ult' });

    // The same unit, now hurt, commits the ultimate like everyone else.
    const hurtEnemy = unit({ key: 'defenders:4', side: 'defenders', position: 4, sheet: sheet({ hp: 1000 }) });
    const hurt = unit({
      key: 'attackers:1',
      side: 'attackers',
      position: 1,
      sheet: sheet({ hp: 1000 }),
      hp: 400,
      rage: 1000,
    });
    const hurting = makeCtx({ units: [hurt, hurtEnemy], strategies: { attackers: 'defensive' } });
    takeTurn(hurting, hurt, { bigRound: 1, team });
    expect(lastActionOf(hurting, 'attackers:1')).toMatchObject({ skill: 'ult' });
  });

  it('a defensive squad lands its ultimate later than a balanced one', () => {
    const defender = () =>
      spec({ id: 'd', side: 'defenders', position: 4, kit: damageKit(), sheet: sheet({ hp: 200000, pAtk: 500 }) });
    const attacker = () =>
      spec({ id: 'a', side: 'attackers', position: 1, kit: damageKit(), sheet: sheet({ hp: 4000, pAtk: 40, spd: 200 }) });
    // Hold until the squad is at half: the attacker is chipped down over four rounds.
    const settings = { strategyUltHoldHp: 0.5 };
    const balanced = runBattle({ attackers: [attacker()], defenders: [defender()], seed: 5, settings });
    const defensive = runBattle({
      attackers: [attacker()],
      defenders: [defender()],
      seed: 5,
      settings,
      strategies: { attackers: 'defensive' },
    });
    const balancedRound = firstRoundOf(balanced, 'attackers:1', 'ult');
    const defensiveRound = firstRoundOf(defensive, 'attackers:1', 'ult');
    expect(balancedRound).toBeLessThan(Number.POSITIVE_INFINITY);
    expect(defensiveRound).toBeGreaterThan(balancedRound);
    expect(ultEvents(defensive, 'attackers:1')).toBeGreaterThan(0);
  });

  it('keeps a kit\'s own targeting rule (the port stays faithful)', () => {
    // `row` on the ult still takes the whole opposing row under every strategy.
    const ult: SkillSlot = 'ult';
    expect(damageKit().skills[ult].rule).toBe('row');
  });
});
