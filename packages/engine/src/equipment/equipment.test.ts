import { describe, expect, it } from 'vitest';
import { runBattle } from '../combat/battle';
import type { KitDef, RoundEffect, SheetInput, SpecInput } from '../combat/types';
import { foldLoadout, lineValue, mergeDelta } from './contrib';
import {
  allocateTalent,
  canAllocateTalent,
  canEquipRelic,
  equipRune,
  relicLevelCost,
  relicUnlocked,
  talentsUnlocked,
} from './rules';
import {
  emptyLoadout,
  type EquipmentState,
  type EquipmentTables,
  type EquipmentTuning,
  type Loadout,
} from './types';

const TUNING: EquipmentTuning = {
  relic: { minTier: 'supreme', maxLevel: 5, maxRefine: 5 },
  runes: { minStars: 3, sockets: 4, maxLevel: 6 },
  charms: { minStars: 4, slots: 1 },
  cores: { minStars: 10, sockets: 6, pieceMinStars: 2, pieceMaxStars: 5 },
  talents: { minTier: 'legendary', tiers: 9, optionsPerTier: 3, resetGems: 50, allocateGold: 50 },
  relicLevelCost: { gold: 100, candy: 10, goldPerLevel: 50, candyPerLevel: 5 },
  relicRefineCost: { gold: 200, stone: 1, goldPerRefine: 100, stonePerRefine: 1 },
  runeLevelCost: { gold: 100, goldPerLevel: 50 },
  starting: { relics: [], runes: [], cores: [], charms: [] },
};

const TABLES: EquipmentTables = {
  relics: [
    {
      id: 'relicA',
      name: 'A',
      className: 'striker',
      tier: 'supreme',
      lines: [
        { kind: 'core', field: 'pAtk', base: 40, perLevel: 20 },
        { kind: 'percent', field: 'crit', base: 0.05, perLevel: 0.01 },
      ],
      effect: { tag: 'relicA', text: '+dmg late', field: 'dmgBoost', add: 0.2, fromRound: 3 },
    },
  ],
  runes: [
    { id: 'rune1', name: 'Rune 1', setId: 'setA', tier: 'common', lines: [{ kind: 'percent', field: 'dmgBoost', base: 0.03, perLevel: 0.01 }] },
    { id: 'rune2', name: 'Rune 2', setId: 'setA', tier: 'rare', lines: [{ kind: 'percent', field: 'dmgBoost', base: 0.03, perLevel: 0.01 }] },
    { id: 'rune3', name: 'Rune 3', setId: 'setA', tier: 'epic', lines: [{ kind: 'core', field: 'hp', base: 100, perLevel: 20 }] },
    { id: 'rune4', name: 'Rune 4', setId: 'setA', tier: 'legendary', lines: [{ kind: 'percent', field: 'crit', base: 0.02, perLevel: 0.01 }] },
  ],
  runeSets: [
    {
      id: 'setA',
      name: 'Set A',
      bonuses: [
        { pieces: 2, lines: [{ kind: 'percent', field: 'dmgBoost', base: 0.05, perLevel: 0 }] },
        { pieces: 4, lines: [{ kind: 'percent', field: 'critPower', base: 0.1, perLevel: 0 }] },
      ],
    },
  ],
  charms: [
    { id: 'charm1', name: 'Charm 1', tier: 'greater', maxStars: 3, lines: [{ kind: 'core', field: 'hp', base: 200, perLevel: 100 }] },
    { id: 'charm0', name: 'Charm 0', tier: 'common', maxStars: 0, lines: [{ kind: 'percent', field: 'dmgBoost', base: 0.05, perLevel: 0 }] },
  ],
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
  ],
  talentBlocks: [
    { id: 'b1', text: 'flat atk', lines: [{ kind: 'core', field: 'pAtk', base: 50, perLevel: 0 }] },
    { id: 'b2', text: 'dmg', lines: [{ kind: 'percent', field: 'dmgBoost', base: 0.04, perLevel: 0 }] },
    { id: 'b3', text: 'crit', lines: [{ kind: 'percent', field: 'crit', base: 0.02, perLevel: 0 }] },
  ],
  talentTrees: [
    {
      id: 'treeA',
      name: 'Tree A',
      className: 'striker',
      tiers: Array.from({ length: 9 }, () => ['b1', 'b2', 'b1']),
    },
  ],
  tuning: TUNING,
};

function stateWith(partial: Partial<EquipmentState>): EquipmentState {
  return { relics: [], runes: [], cores: [], charms: {}, charmStars: {}, nextSeq: 1, ...partial };
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
      relics: [{ id: 're1', defId: 'relicA', level: 3, refine: 2 }],
      runes: [
        { id: 'ru1', defId: 'rune1', level: 6 },
        { id: 'ru2', defId: 'rune2', level: 2 },
        { id: 'ru3', defId: 'rune3', level: 1 },
        { id: 'ru4', defId: 'rune4', level: 1 },
      ],
      cores: [
        { id: 'c1', setId: 'setC', socket: 0, stars: 5 },
        { id: 'c2', setId: 'setC', socket: 1, stars: 2 },
      ],
      charms: { charm1: 3 },
      charmStars: { charm1: 2 },
      nextSeq: 10,
    };
    const loadout = {
      ...emptyLoadout(TUNING),
      relic: 're1',
      runes: ['ru1', 'ru2', 'ru3', 'ru4'],
      charm: 'charm1',
      cores: ['c1', 'c2', null, null, null, null],
      treeId: 'forged',
      talents: Array.from({ length: 9 }, () => -1),
    };
    const folded = foldLoadout(loadout, state, TABLES);
    // relic level 3: pAtk 80, crit 0.07
    expect(folded.layers.relic.core.pAtk).toBeCloseTo(80);
    expect(folded.layers.relic.percent.crit).toBeCloseTo(0.07);
    // per-rune lines (.08 + .04) plus the 2-piece dmgBoost (.05); 4 pieces add critPower (.1)
    expect(folded.layers.runes.percent.dmgBoost).toBeCloseTo(0.17);
    expect(folded.layers.runes.percent.critPower).toBeCloseTo(0.1);
    // charms at 2 stars: hp 300
    expect(folded.layers.charms.core.hp).toBeCloseTo(300);
    // cores: soul lines + 2-piece bonus
    expect(folded.layers.cores.soul.spiritAtk).toBeCloseTo(30); // 10 + 4×5
    expect(folded.layers.cores.percent.dmgBoost).toBeCloseTo(0.1);
    // relic + core effects are forwarded
    expect(folded.effects.map((e) => e.tag).sort()).toEqual(['relicA']);
  });

  it('ignores an equipped charm the account does not own', () => {
    const state: EquipmentState = { relics: [], runes: [], cores: [], charms: {}, charmStars: {}, nextSeq: 1 };
    const loadout = { ...emptyLoadout(TUNING), charm: 'charm0' };
    const folded = foldLoadout(loadout, state, { ...TABLES, tuning: TUNING });
    expect(folded.layers.charms.percent.dmgBoost).toBeUndefined();
  });

  it('scales a relic effect with its refine level', () => {
    const base = foldLoadout(
      { ...emptyLoadout(TUNING), relic: 're1' },
      { relics: [{ id: 're1', defId: 'relicA', level: 1, refine: 0 }], runes: [], cores: [], charms: {}, charmStars: {}, nextSeq: 1 },
      TABLES,
    );
    const refined = foldLoadout(
      { ...emptyLoadout(TUNING), relic: 're1' },
      { relics: [{ id: 're1', defId: 'relicA', level: 1, refine: 5 }], runes: [], cores: [], charms: {}, charmStars: {}, nextSeq: 1 },
      TABLES,
    );
    const baseAdd = base.effects[0]?.add ?? 0;
    const refinedAdd = refined.effects[0]?.add ?? 0;
    expect(refinedAdd).toBeGreaterThan(baseAdd);
    expect(refinedAdd).toBeCloseTo(baseAdd * 2);
  });
});

describe('rules', () => {
  it('gates relics on class and tier', () => {
    const def = TABLES.relics[0]!;
    expect(canEquipRelic(def, 'striker', 'supreme', TUNING)).toBe(true);
    expect(canEquipRelic(def, 'guardian', 'mythic', TUNING)).toBe(false);
    expect(canEquipRelic(def, 'striker', 'epic', TUNING)).toBe(false);
    expect(relicUnlocked('mythic', TUNING)).toBe(true);
    expect(talentsUnlocked('epic', TUNING)).toBe(false);
  });

  it('prices relic level-ups and refines by current level', () => {
    expect(relicLevelCost(1, TUNING)).toEqual({ gold: 100, candy: 10 });
    expect(relicLevelCost(3, TUNING)).toEqual({ gold: 200, candy: 20 });
  });

  it('sockets a rune into a chosen slot only', () => {
    const loadout = equipRune(emptyLoadout(TUNING), 1, 'ru1');
    expect(loadout.runes[0]).toBeNull();
    expect(loadout.runes[1]).toBe('ru1');
  });

  it('allocates talents sequentially and clears later tiers on a re-pick', () => {
    const tree = { id: 't', name: 'T', className: 'striker' as const, tiers: Array.from({ length: 9 }, () => ['b1', 'b2', 'b3']) };
    let loadout: Loadout = { ...emptyLoadout(TUNING), treeId: 't' };
    expect(canAllocateTalent(loadout, tree, 2, 0, TUNING)).toBe(false); // tier 0/1 empty
    loadout = allocateTalent(loadout, 0, 1, TUNING);
    loadout = allocateTalent(loadout, 1, 2, TUNING);
    expect(loadout.talents[0]).toBe(0 + 1);
    expect(canAllocateTalent(loadout, tree, 2, 0, TUNING)).toBe(true);
    loadout = allocateTalent(loadout, 0, 2, TUNING);
    expect(loadout.talents[0]).toBe(2);
    expect(loadout.talents[1]).toBe(-1); // later tiers cleared
  });
});

// --- battle impact ---------------------------------------------------------

const KIT = {
  id: 'kit',
  name: 'Kit',
  faction: 'ember' as const,
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

// Each of the five layers must change a battle outcome in its intended direction.
function battleWith(baseSheet: SheetInput, state: EquipmentState, loadout: Loadout) {
  const folded = foldLoadout(loadout, state, TABLES);
  return runBattle({
    attackers: [attacker(mergeDelta(baseSheet, folded.delta), folded.effects)],
    defenders: [defender(120000)],
    seed: 11,
  });
}

describe('every layer moves a battle in the intended direction', () => {
  const base: SheetInput = { hp: 5000, pAtk: 400, sAtk: 1, spd: 30 };
  const plainDamage = () =>
    runBattle({ attackers: [attacker(base)], defenders: [defender(120000)], seed: 11 }).damageDealt['attackers:4'] ?? 0;

  it('relic core/percent lines raise damage', () => {
    const state = stateWith({ relics: [{ id: 're1', defId: 'relicA', level: 3, refine: 0 }] });
    const up = battleWith(base, state, { ...emptyLoadout(TUNING), relic: 're1' });
    expect(up.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());
  });

  it('a rune set bonus raises damage', () => {
    const state = stateWith({
      runes: [
        { id: 'ru1', defId: 'rune1', level: 1 },
        { id: 'ru2', defId: 'rune2', level: 1 },
        { id: 'ru3', defId: 'rune3', level: 1 },
      ],
    });
    const up = battleWith(base, state, { ...emptyLoadout(TUNING), runes: ['ru1', 'ru2', 'ru3', null] });
    expect(up.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());
  });

  it('a charm damage line raises damage while its hp line raises max HP', () => {
    const dmgState = stateWith({ charms: { charm0: 1 }, charmStars: { charm0: 1 } });
    const dmgUp = battleWith(base, dmgState, { ...emptyLoadout(TUNING), charm: 'charm0' });
    expect(dmgUp.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());

    const hpState = stateWith({ charms: { charm1: 1 }, charmStars: { charm1: 1 } });
    const hpUp = battleWith(base, hpState, { ...emptyLoadout(TUNING), charm: 'charm1' });
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
        { id: 'c1', setId: 'setC', socket: 0, stars: 3 },
        { id: 'c2', setId: 'setC', socket: 1, stars: 3 },
      ],
    });
    const up = battleWith(base, state, { ...emptyLoadout(TUNING), cores: ['c1', 'c2', null, null, null, null] });
    expect(up.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());
  });

  it('a talent block raises damage', () => {
    const state = stateWith({});
    const loadout = { ...emptyLoadout(TUNING), treeId: 'treeA', talents: [1, -1, -1, -1, -1, -1, -1, -1, -1] };
    const up = battleWith(base, state, loadout);
    expect(up.damageDealt['attackers:4'] ?? 0).toBeGreaterThan(plainDamage());
  });
});
