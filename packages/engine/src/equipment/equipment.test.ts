import { describe, expect, it } from 'vitest';
import { runBattle } from '../combat/battle';
import type { KitDef, RoundEffect, SheetInput, SpecInput } from '../combat/types';
import type { CoreStats } from '../model';
import { foldLoadout, lineValue, mergeDelta } from './contrib';
import {
  canEquipRelic,
  equipOrb,
  relicUnlocked,
} from './rules';
import { ORB_TABLES } from './orbs.fixture';
import {
  emptyLoadout,
  type EquipmentState,
  type EquipmentTables,
  type EquipmentTuning,
  type Loadout,
} from './types';

const TUNING: EquipmentTuning = {
  relic: { minTier: 'supreme' },
  berries: { minStars: 4, slots: 2 },
  cores: { minStars: 10, sockets: 6, qualityStars: { blue: 2, purple: 3, orange: 4, red: 5 }, starExp: { blue: [100, 200], purple: [300, 600, 1050], orange: [600, 1200, 2100, 3000], red: [900, 1800, 3150, 4500, 7200] } },
  starting: { relics: [], cores: [], berries: [] },
};

const TABLES: EquipmentTables = {
  relics: [
    {
      id: 'relicA',
      name: 'A',
      className: 'striker',
      tier: 'supreme',
      mainPool: 1,
      linePool: 1,
      lineCount: 3,
      refineSlots: 1,
      dismantle: 20,
      skill: {
        id: 's1',
        name: 'A II',
        text: '+dmg late',
        active: true,
        effects: [{ tag: 'relicA', field: 'dmgBoost', add: 0.2, fromRound: 3 }],
      },
    },
  ],
  held: {
    mainPool: [
      { index: 101, pool: 1, group: 1, weight: 100, name: 'P.ATK', kind: 'core', field: 'pAtk', value: 40, every: 1, step: 20 },
    ],
    linePool: [
      { index: 11, pool: 1, weight: 100, name: 'Critical', kind: 'percent', field: 'crit', min: 500, max: 900 },
      { index: 12, pool: 1, weight: 100, name: 'Fire Ult DMG↑', kind: 'percent', field: 'ultBoost', faction: 'fire', min: 600, max: 1500 },
      { index: 13, pool: 1, weight: 100, name: 'Water Ult DMG↑', kind: 'percent', field: 'ultBoost', faction: 'water', min: 600, max: 1500 },
    ],
    levelCost: [20, 20, 25],
    levelGates: [],
    refineLadder: [0, 1, 1],
    resetterCompound: 20,
  },
  plates: {
    unlock: { playerLevel: 34, stars: 6 },
    plates: [{ id: 1, name: 'Common Plate' }],
    stages: Array.from({ length: 19 }, (_, stage) => ({ stage, hp: stage * 100, pAtk: stage * 10, sAtk: stage * 10, hpPct: stage >= 6 ? 0.1 : 0 })),
    steps: [],
    skillSwapStage: 6,
    species: { sp1: [[3, 1]] },
  },
  trinkets: [
    {
      id: 'trinketA',
      name: 'Trinket A',
      speciesId: 'sp1',
      sourceId: 1,
      item: { id: 2, name: 'Item A' },
      // R6b: one row per level (flat values), as the source table.
      levels: Array.from({ length: 41 }, (_, n) => ({
        rank: 0,
        lines:
          n === 0
            ? []
            : [
                { kind: 'core' as const, field: 'pAtk', base: 12 * n, perLevel: 0 },
                { kind: 'percent' as const, field: 'dmgBoost', base: 0.01 * n, perLevel: 0 },
              ],
        cost: n < 40 ? { starShard: 10, item: 0 } : null,
      })),
      skills: [],
    },
  ],
  trinketRules: { unlock: { rosterCount: 0, rosterLevel: 0, stars: 0 }, maxLevel: 40, chests: [] },
  orbs: ORB_TABLES,
  // R6d: a small berry table — 2★ adds HP 300, +1 stage HP 50; line kind 1 = DMG Boost.
  berries: {
    linesAtStart: 1,
    maxLines: 5,
    cultivateEssence: 100,
    fastCultivateTimes: 10,
    reforgePotions: [10, 20, 35, 35, 35],
    rebirthGems: 100,
    stars: [
      { star: 1, hp: 200, pAtk: 0, sAtk: 0, next: { sameCopies: 1, anyCopies: 2, gold: 100 } },
      { star: 2, hp: 300, pAtk: 0, sAtk: 0, next: null },
    ],
    breakthrough: [{ stage: 1, trainerLevel: 40, cost: { currency: 'berryMulchBlue', amount: 10 }, hp: 50, pAtk: 0, sAtk: 0 }],
    elements: [{ id: 1, kind: 'percent', field: 'dmgBoost', caps: [0.05, 0.1, 0.2, 0.4, 0.6] }],
    berries: [
      { id: 'berry1', sourceId: 1, name: 'Berry 1', tier: 'greater', typeId: 1, initStar: 1, maxStar: 2, dismantleEssence: 40, skills: [] },
    ],
  },
  coreSets: [
    {
      id: 'setC',
      name: 'Core Set C',
      socketLines: [
        [{ kind: 'soul', field: 'spiritAtk', base: 10, perLevel: 5 }],
        [{ kind: 'soul', field: 'spiritDef', base: 8, perLevel: 4 }],
        [{ kind: 'soul', field: 'spiritAtk', base: 12, perLevel: 6 }],
        [{ kind: 'soul', field: 'spiritDef', base: 6, perLevel: 3 }],
        [{ kind: 'soul', field: 'spiritAtk', base: 9, perLevel: 3 }],
        [{ kind: 'soul', field: 'spiritDef', base: 11, perLevel: 5 }],
      ],
      bonuses: [
        { pieces: 2, lines: [{ kind: 'percent', field: 'dmgBoost', base: 0.1, perLevel: 0 }] },
        { pieces: 4, lines: [{ kind: 'percent', field: 'dmgRdct', base: 0.05, perLevel: 0 }] },
        { pieces: 6, lines: [], effect: { tag: 'core6', text: '+atk later', field: 'pAtk', mult: 1.15, fromRound: 3 } },
      ],
    },
    {
      id: 'setL',
      name: 'Lifesteal Set',
      socketLines: [
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
      ],
      bonuses: [{ pieces: 2, lines: [], text: 'lifesteal only', soulheart: { text: 'lifesteal only', lifesteal: 0.5 } }],
    },
    {
      id: 'setS',
      name: 'Soul Set',
      socketLines: [
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
        [{ kind: 'core', field: 'hp', base: 100, perLevel: 50 }],
      ],
      bonuses: [
        { pieces: 2, lines: [], text: 'shield', soulheart: { text: 'shield', startShield: 0.2 } },
        {
          pieces: 4,
          lines: [],
          text: 'lifesteal',
          soulheart: { text: 'lifesteal', startShield: 0.3, lifesteal: 0.5 },
        },
        { pieces: 6, lines: [], text: 'pierce', soulheart: { text: 'pierce', shieldDmgBonus: 0.5 } },
      ],
    },
  ],
  tuning: TUNING,
};

function stateWith(partial: Partial<EquipmentState>): EquipmentState {
  return { relics: [], orbs: [], cores: [], berries: [], nextSeq: 1, ...partial };
}

describe('stat lines', () => {
  it('scales base + perLevel × (value − 1)', () => {
    expect(lineValue({ kind: 'core', field: 'hp', base: 100, perLevel: 20 }, 3)).toBe(140);
    expect(lineValue({ kind: 'percent', field: 'crit', base: 0.05, perLevel: 0.01 }, 1)).toBeCloseTo(0.05);
  });

  it('merges a delta into a sheet, rounding flat values and keeping fractions', () => {
    const sheet: SheetInput = { hp: 1000, pAtk: 100, sAtk: 10, spd: 20 };
    const merged = mergeDelta(sheet, { core: { hp: 150.4 }, percent: { dmgBoost: 0.15 }, soul: { spiritAtk: 7 } });
    expect(merged.hp).toBe(1150);
    expect(merged.dmgBoost).toBeCloseTo(0.15);
    expect(merged.spiritAtk).toBe(7);
  });
});

describe('layer contributions', () => {
  it('folds every layer into the delta and reports per-layer lines', () => {
    const state: EquipmentState = {
      relics: [{ id: 're1', defId: 'relicA', level: 2, group: 1, lines: [{ index: 11, value: 700, refines: 0 }, { index: 12, value: 1000, refines: 0 }, { index: 13, value: 1000, refines: 0 }], refines: 0, pending: null, locked: false }],
      orbs: [
        { id: 'ru1', kind: 'sharp', colour: 'red', level: 3, lines: [{ field: 'dmgBoost', roll: 1 }] },
        { id: 'ru2', kind: 'placating', colour: 'red', level: 3, lines: [] },
        { id: 'ru3', kind: 'mystique', colour: 'red', level: 5, lines: [] },
      ],
      cores: [
        { id: 'c1', setId: 'setC', socket: 0, quality: 'red' as const, stars: 4 },
        { id: 'c2', setId: 'setC', socket: 1, quality: 'red' as const, stars: 1 },
      ],
      berries: [{ id: 'be1', defId: 'berry1', star: 2, stage: 1, lines: [{ element: 1, value: 0.05 }], cultivated: true, locked: false }],
      nextSeq: 10,
    };
    const loadout = {
      ...emptyLoadout(TUNING),
      relic: 're1',
      orbs: ['ru1', 'ru2', 'ru3', null, null, null, null, null],
      berries: ['be1', null],
      cores: ['c1', 'c2', null, null, null, null],
    };
    const folded = foldLoadout(
      loadout,
      state,
      TABLES,
      { faction: 'fire', stage: 5 },
      { speciesId: 'sp1', level: 5 },
      { level: 5, perLevel: { pAtk: 10, spd: 0.1 } },
      { lines: [{ kind: 'core', field: 'hp', base: 100, perLevel: 0 }] },
    );
    // held item level 2: pAtk 40 + 2×20, Critical 700 → 0.07; only the fire (own-faction) line counts
    expect(folded.layers.relic.core.pAtk).toBeCloseTo(80);
    expect(folded.layers.relic.percent.crit).toBeCloseTo(0.07);
    expect(folded.layers.relic.percent.ultBoost).toBeCloseTo(0.1);
    // plate stage 5: the stage row (pAtk 50, no Total HP before stage 6)
    expect(folded.layers.plates.core.pAtk).toBeCloseTo(50);
    expect(folded.layers.plates.percent.hpPct ?? 0).toBe(0);
    // trinket level 5: pAtk 60, dmgBoost 0.05
    expect(folded.layers.trinkets.core.pAtk).toBeCloseTo(60);
    expect(folded.layers.trinkets.percent.dmgBoost).toBeCloseTo(0.05);
    // resonance level 5 at +10 pAtk / +0.1 spd per level
    expect(folded.layers.resonance.core.pAtk).toBeCloseTo(50);
    expect(folded.layers.resonance.core.spd).toBeCloseTo(0.5);
    // title lines are account-wide and independent of the loadout
    expect(folded.layers.titles.core.hp).toBeCloseTo(100);
    // orbs: Sharp's DMG Boost line at +3 (3 × 0.8%); DMG Down is on at its lowest orb (+3): Orb ATK +15%
    expect(folded.layers.runes.percent.dmgBoost).toBeCloseTo(0.024);
    expect(folded.layers.runes.core.pAtk).toBe(Math.round((639 + 1846) * 1.15)); // Sharp +3 and Mystique +5
    expect(folded.layers.runes.percent.dmgRdct ?? 0).toBe(0); // the +5 tier needs every orb at +5
    // berry at 2★ +1: hp 300 + 50, its DMG Boost line
    expect(folded.layers.berries.core.hp).toBeCloseTo(350);
    expect(folded.layers.berries.percent.dmgBoost).toBeCloseTo(0.05);
    // cores: soul lines + 2-piece bonus
    expect(folded.layers.cores.soul.spiritAtk).toBeCloseTo(30); // 10 + 4×5
    expect(folded.layers.cores.percent.dmgBoost).toBeCloseTo(0.1);
    // relic + core effects are forwarded
    expect(folded.effects.map((e) => e.tag).sort()).toEqual(['relicA']);
  });

  it('ignores a berry slot that names no owned berry', () => {
    const state: EquipmentState = { relics: [], orbs: [], cores: [], berries: [], nextSeq: 1 };
    const loadout = { ...emptyLoadout(TUNING), berries: ['missing', null] };
    const folded = foldLoadout(loadout, state, { ...TABLES, tuning: TUNING });
    expect(folded.layers.berries.core.hp).toBeUndefined();
  });
});

describe('rules', () => {
  it('gates relics on class and tier', () => {
    const def = TABLES.relics[0]!;
    expect(canEquipRelic(def, 'striker', 'supreme', TUNING)).toBe(true);
    expect(canEquipRelic(def, 'guardian', 'mythic', TUNING)).toBe(false);
    expect(canEquipRelic(def, 'striker', 'epic', TUNING)).toBe(false);
    expect(relicUnlocked('mythic', TUNING)).toBe(true);
    expect(relicUnlocked('origin', TUNING)).toBe(true);
  });

  it('sockets an orb into a chosen slot only', () => {
    const loadout = equipOrb(emptyLoadout(TUNING), 1, 'ru1');
    expect(loadout.orbs[0]).toBeNull();
    expect(loadout.orbs[1]).toBe('ru1');
  });
});

// --- battle impact ---------------------------------------------------------

const KIT = {
  id: 'kit',
  name: 'Kit',
  faction: 'fire' as const,
  class: 'striker' as const,
  tier: 'common' as const,
  skills: {
    normal: { slot: 'normal' as const, type: 'P' as const, rates: [1], rule: 'lowest_hp' as const },
    basic: { slot: 'basic' as const, type: 'P' as const, rates: [1.5], rule: 'lowest_hp' as const },
    ult: { slot: 'ult' as const, type: 'P' as const, rates: [2], rule: 'lowest_hp' as const },
  },
} satisfies KitDef;

function attacker(sheet: SheetInput, effects?: RoundEffect[]): SpecInput {
  return { id: 'a', name: 'A', position: 4, side: 'attackers', kit: KIT, sheet, roundEffects: effects };
}

function defender(hp: number): SpecInput {
  return { id: 'd', name: 'D', position: 1, side: 'defenders', kit: KIT, sheet: { hp, pAtk: 1, sAtk: 1, spd: 1 } };
}

describe('equipment changes battle outcomes', () => {
  it('a dmgBoost line makes an otherwise-unwinnable fight winnable', () => {
    const baseSheet: SheetInput = { hp: 5000, pAtk: 400, sAtk: 1, spd: 30 };
    // Total damage the plain attacker can do in the whole time-out window.
    const probe = runBattle({ attackers: [attacker(baseSheet)], defenders: [defender(200000)], seed: 7 });
    const plainTotal = probe.damageDealt['attackers:4'] ?? 0;
    expect(plainTotal).toBeGreaterThan(0);

    const foeHp = Math.round(plainTotal * 2);
    const plain = runBattle({ attackers: [attacker(baseSheet)], defenders: [defender(foeHp)], seed: 7 });
    const boosted = runBattle({
      attackers: [attacker(mergeDelta(baseSheet, { core: {}, percent: { dmgBoost: 5 }, soul: {} }))],
      defenders: [defender(foeHp)],
      seed: 7,
    });
    expect(plain.winner).toBe('defenders');
    expect(boosted.winner).toBe('attackers');
  });

  it('a round effect lands at its round and lifts later damage', () => {
    const baseSheet: SheetInput = { hp: 5000, pAtk: 400, sAtk: 1, spd: 30 };
    const effect: RoundEffect = { tag: 'late', field: 'dmgBoost', add: 3, fromRound: 3 };
    const plain = runBattle({ attackers: [attacker(baseSheet)], defenders: [defender(60000)], seed: 11 });
    const late = runBattle({ attackers: [attacker(baseSheet, [effect])], defenders: [defender(60000)], seed: 11 });
    expect(late.damageDealt['attackers:4']).toBeGreaterThan(plain.damageDealt['attackers:4'] ?? 0);
    expect(late.events.some((e) => e.type === 'buffApplied' && e.tag === 'late')).toBe(true);
  });

  it('soul stats from cores feed the soul factor', () => {
    const baseSheet: SheetInput = { hp: 5000, pAtk: 400, sAtk: 1, spd: 30 };
    const plain = runBattle({ attackers: [attacker(baseSheet)], defenders: [defender(60000)], seed: 3, mode: 'pvp' });
    const souled = runBattle({
      attackers: [attacker(mergeDelta(baseSheet, { core: {}, percent: {}, soul: { spiritAtk: 80000 } }))],
      defenders: [defender(60000)],
      seed: 3,
      mode: 'pvp',
    });
    expect(souled.damageDealt['attackers:4']).toBeGreaterThan(plain.damageDealt['attackers:4'] ?? 0);
  });
});

// Every gear layer must change a battle outcome in its intended direction.
function battleWith(
  baseSheet: SheetInput,
  state: EquipmentState,
  loadout: Loadout,
  plate?: { faction: 'fire'; stage: number },
  trinket?: { speciesId: string; level: number },
  resonance?: { level: number; perLevel: Partial<CoreStats> },
  title?: { lines: { kind: 'core'; field: 'pAtk'; base: number; perLevel: number }[] },
) {
  const folded = foldLoadout(loadout, state, TABLES, plate, trinket, resonance, title);
  return runBattle({
    attackers: [{ ...attacker(mergeDelta(baseSheet, folded.delta), folded.effects), soulheart: folded.soulheart }],
    defenders: [defender(120000)],
    seed: 11,
  });
}

describe('every layer moves a battle in the intended direction', () => {
  const base: SheetInput = { hp: 5000, pAtk: 400, sAtk: 1, spd: 30 };
  const plainDamage = () =>
    runBattle({ attackers: [attacker(base)], defenders: [defender(120000)], seed: 11 }).damageDealt['attackers:4'] ?? 0;

  it('relic core/percent lines raise damage', () => {
    const state = stateWith({ relics: [{ id: 're1', defId: 'relicA', level: 2, group: 1, lines: [{ index: 11, value: 700, refines: 0 }, { index: 12, value: 1000, refines: 0 }, { index: 13, value: 1000, refines: 0 }], refines: 0, pending: null, locked: false }] });
    const up = battleWith(base, state, { ...emptyLoadout(TUNING), relic: 're1' });
    expect(up.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());
  });

  it('a plate stage raises damage', () => {
    const up = battleWith(base, stateWith({}), emptyLoadout(TUNING), { faction: 'fire', stage: 10 });
    expect(up.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());
  });

  it('a species trinket level raises damage', () => {
    const up = battleWith(
      base,
      stateWith({}),
      emptyLoadout(TUNING),
      undefined,
      { speciesId: 'sp1', level: 10 },
    );
    expect(up.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());
  });

  it('a resonance share raises damage', () => {
    const up = battleWith(base, stateWith({}), emptyLoadout(TUNING), undefined, undefined, {
      level: 40,
      perLevel: { pAtk: 10, hp: 20 },
    });
    expect(up.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());
  });

  it('an equipped title raises damage', () => {
    const up = battleWith(base, stateWith({}), emptyLoadout(TUNING), undefined, undefined, undefined, {
      lines: [{ kind: 'core', field: 'pAtk', base: 250, perLevel: 0 }],
    });
    expect(up.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());
  });

  it('orbs and their set raise damage', () => {
    const state = stateWith({
      orbs: [
        { id: 'ru1', kind: 'sharp', colour: 'red', level: 3, lines: [{ field: 'dmgBoost', roll: 1 }] },
        { id: 'ru2', kind: 'placating', colour: 'red', level: 3, lines: [] },
        { id: 'ru3', kind: 'mystique', colour: 'red', level: 3, lines: [] },
      ],
    });
    const up = battleWith(base, state, { ...emptyLoadout(TUNING), orbs: ['ru1', 'ru2', 'ru3', null, null, null, null, null] });
    expect(up.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());
  });

  it('a berry DMG Boost line raises damage while its star HP raises max HP', () => {
    const berry = { id: 'be1', defId: 'berry1', star: 1, stage: 0, lines: [{ element: 1, value: 0.05 }], cultivated: true, locked: false };
    const dmgState = stateWith({ berries: [berry] });
    const dmgUp = battleWith(base, dmgState, { ...emptyLoadout(TUNING), berries: ['be1', null] });
    expect(dmgUp.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());

    const hpState = stateWith({ berries: [{ ...berry, lines: [] }] });
    const hpUp = battleWith(base, hpState, { ...emptyLoadout(TUNING), berries: ['be1', null] });
    const plainHp =
      runBattle({ attackers: [attacker(base)], defenders: [defender(120000)], seed: 11 }).units.find(
        (u) => u.side === 'attackers',
      )?.maxHp ?? 0;
    const boostedHp = hpUp.units.find((u) => u.side === 'attackers')?.maxHp ?? 0;
    expect(boostedHp).toBeGreaterThan(plainHp);
  });

  it('a spirit-core 2-piece bonus raises damage', () => {
    const state = stateWith({
      cores: [
        { id: 'c1', setId: 'setC', socket: 0, quality: 'red' as const, stars: 2 },
        { id: 'c2', setId: 'setC', socket: 1, quality: 'red' as const, stars: 2 },
      ],
    });
    const up = battleWith(base, state, { ...emptyLoadout(TUNING), cores: ['c1', 'c2', null, null, null, null] });
    expect(up.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());
  });

  it('a Soul-heart start shield absorbs damage and a lifesteal set heals the holder', () => {
    const shieldState = stateWith({
      cores: [
        { id: 's1', setId: 'setS', socket: 0, quality: 'red' as const, stars: 1 },
        { id: 's2', setId: 'setS', socket: 1, quality: 'red' as const, stars: 1 },
      ],
    });
    const shielded = battleWith(base, shieldState, {
      ...emptyLoadout(TUNING),
      cores: ['s1', 's2', null, null, null, null],
    });
    expect(shielded.events.some((e) => e.type === 'shield' && e.tgt === 'attackers:4' && e.amount > 0)).toBe(true);

    const leechState = stateWith({
      cores: [
        { id: 'l1', setId: 'setL', socket: 0, quality: 'red' as const, stars: 1 },
        { id: 'l2', setId: 'setL', socket: 1, quality: 'red' as const, stars: 1 },
      ],
    });
    const leeched = battleWith(base, leechState, {
      ...emptyLoadout(TUNING),
      cores: ['l1', 'l2', null, null, null, null],
    });
    const healed = leeched.units.find((u) => u.key === 'attackers:4')?.healingDone ?? 0;
    expect(healed).toBeGreaterThan(0);
  });

  it('a shield-damage Soul-heart hook raises damage against a shielded foe', () => {
    const baseSheet: SheetInput = { hp: 5000, pAtk: 400, sAtk: 1, spd: 30 };
    const shieldedFoe: SpecInput = {
      ...defender(120000),
      soulheart: { startShield: 0.5 },
    };
    const plain = runBattle({ attackers: [attacker(baseSheet)], defenders: [shieldedFoe], seed: 11 });
    const hooked = runBattle({
      attackers: [{ ...attacker(baseSheet), soulheart: { shieldDmgBonus: 0.5 } }],
      defenders: [shieldedFoe],
      seed: 11,
    });
    expect(hooked.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plain.damageDealt['attackers:4'] ?? 0);
  });

  it('same-stat Soul-heart ladders keep the highest reached value', () => {
    const cores = [
      { id: 's1', setId: 'setS', socket: 0, quality: 'red' as const, stars: 1 },
      { id: 's2', setId: 'setS', socket: 1, quality: 'red' as const, stars: 1 },
      { id: 's3', setId: 'setS', socket: 2, quality: 'red' as const, stars: 1 },
      { id: 's4', setId: 'setS', socket: 3, quality: 'red' as const, stars: 1 },
    ];
    const folded = foldLoadout(
      { ...emptyLoadout(TUNING), cores: ['s1', 's2', 's3', 's4', null, null] },
      stateWith({ cores }),
      TABLES,
    );
    expect(folded.soulheart.startShield).toBeCloseTo(0.3);
    expect(folded.soulheart.lifesteal).toBeCloseTo(0.5);
    expect(folded.soulheartText).toContain('shield');
    expect(folded.soulheartText).toContain('lifesteal');
  });
});
