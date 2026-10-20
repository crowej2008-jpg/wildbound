import {
  charmsUnlocked,
  computePower,
  coresUnlocked,
  emptyLoadout,
  foldLoadout,
  mergeDelta,
  relicLevelCost,
  relicRefineCost,
  relicUnlocked,
  runesUnlocked,
  talentsUnlocked,
  type EquipmentTables,
  type LayerDelta,
  type Loadout,
  type PercentLines,
  type SheetInput,
  type SoulStats,
  type StatDelta,
  type Tier,
  type WildClass,
} from '@wildbound/engine';
import type { AccountState, WildInstance } from '@wildbound/engine';
import type { GameConfig } from './config';
import { sheetOf } from './battle';

/**
 * Display-ready equipment view (M7). Built server-side so the client never has to
 * re-derive rules; the client only renders and calls actions.
 */

/** Copy cost to raise a charm one star (M7 assumption, see docs/ASSUMPTIONS.md). */
export const CHARM_UPGRADE_COPIES = 2;

export interface RelicView {
  instanceId: string;
  defId: string;
  name: string;
  className: WildClass;
  tier: Tier;
  level: number;
  refine: number;
  maxLevel: number;
  maxRefine: number;
  effectText: string;
  levelCost: { gold: number; candy: number } | null;
  refineCost: { gold: number; stone: number } | null;
  equippedOn: string | null;
}

export interface RuneView {
  instanceId: string;
  defId: string;
  name: string;
  setId: string;
  setName: string;
  tier: Tier;
  level: number;
  maxLevel: number;
  equippedOn: string | null;
}

export interface CoreView {
  instanceId: string;
  setId: string;
  name: string;
  socket: number;
  stars: number;
  equippedOn: string | null;
}

export interface CharmView {
  defId: string;
  name: string;
  tier: string;
  stars: number;
  maxStars: number;
  count: number;
  equippedOn: string | null;
}

export interface TalentTierView {
  tier: number;
  options: { blockId: string; text: string; chosen: boolean }[];
}

export interface TalentTreeOption {
  id: string;
  name: string;
  className: WildClass;
}

export interface EquipmentPowerView {
  /** Power with no equipment equipped. */
  base: number;
  /** Power with the current loadout. */
  equipped: number;
  /** Power gained by each layer alone (equipped minus base, per layer). */
  layers: Record<keyof LayerDelta, number>;
}

export interface EquipmentView {
  wildId: string;
  /** Base combat sheet before equipment (the stat-sheet header). */
  sheet: SheetInput;
  /** Combat sheet with the current loadout folded in. */
  sheetEquipped: SheetInput;
  /** Equipped percent lines, for the stat sheet. */
  percent: Partial<PercentLines>;
  /** Equipped soul stats, for the stat sheet. */
  soul: Partial<SoulStats>;
  power: EquipmentPowerView;
  unlocks: { relic: boolean; runes: boolean; charms: boolean; cores: boolean; talents: boolean };
  requirements: { relic: Tier; runes: number; charms: number; cores: number; talents: Tier };
  loadout: Loadout;
  relics: RelicView[];
  runes: RuneView[];
  runeSets: { id: string; name: string; pieces: number; equipped: number }[];
  cores: CoreView[];
  charms: CharmView[];
  trees: TalentTreeOption[];
  talentTiers: TalentTierView[];
  costs: { talentAllocateGold: number; talentResetGems: number; charmUpgradeCopies: number };
  delta: StatDelta;
  layerDelta: { relic: StatDelta; runes: StatDelta; charms: StatDelta; cores: StatDelta; talents: StatDelta };
  effects: { tag: string; text: string; fromRound: number; bigRounds?: number }[];
}

/** The loadout for a Wild, synthesising an empty one when none is stored. */
export function loadoutOf(state: AccountState, wildId: string, tables: EquipmentTables): Loadout {
  return state.loadouts[wildId] ?? emptyLoadout(tables.tuning);
}

/** Which Wild (if any) currently wears an instance — scan every stored loadout. */
export function equippedOn(state: AccountState, instanceId: string): string | null {
  for (const [wildId, loadout] of Object.entries(state.loadouts)) {
    if (loadout.relic === instanceId) return wildId;
    if (loadout.runes.some((id) => id === instanceId)) return wildId;
    if (loadout.cores.some((id) => id === instanceId)) return wildId;
  }
  return null;
}

export interface EquipmentDeps {
  config: GameConfig;
  state: AccountState;
  wild: WildInstance;
}

/** tag → the authored text a conditional effect should show in the UI. */
function effectTextMap(tables: EquipmentTables): Map<string, string> {
  const map = new Map<string, string>();
  for (const relic of tables.relics) map.set(relic.effect.tag, relic.effect.text);
  for (const set of tables.coreSets) for (const bonus of set.bonuses) if (bonus.effect) map.set(bonus.effect.tag, bonus.effect.text);
  for (const block of tables.talentBlocks) if (block.effect) map.set(block.effect.tag, block.effect.text);
  return map;
}

function powerOfSheet(sheet: SheetInput, percent: Partial<PercentLines>, weights: GameConfig['power']): number {
  const core = {
    hp: sheet.hp,
    pAtk: sheet.pAtk,
    sAtk: sheet.sAtk,
    spd: sheet.spd,
    pDef: sheet.pDef ?? 0,
    sDef: sheet.sDef ?? 0,
  };
  return computePower(core, percent, weights);
}

export function buildEquipmentView({ config, state, wild }: EquipmentDeps): EquipmentView {
  const tables = config.equipment;
  const { tuning } = tables;
  const loadout = loadoutOf(state, wild.id, tables);
  const meta = config.species.get(wild.speciesId);
  const folded = foldLoadout(loadout, state.equipment, tables);
  const baseSheet = sheetOf(wild, config) ?? { hp: 0, pAtk: 0, sAtk: 0, spd: 0, pDef: 0, sDef: 0 };
  const basePower = powerOfSheet(baseSheet, {}, config.power);
  const layerKeys: (keyof LayerDelta)[] = ['relic', 'runes', 'charms', 'cores', 'talents'];
  const layerPower = {} as Record<keyof LayerDelta, number>;
  for (const key of layerKeys) {
    const delta = folded.layers[key];
    const merged = mergeDelta(baseSheet, delta);
    layerPower[key] = powerOfSheet(merged, delta.percent, config.power) - basePower;
  }

  const relicOn = new Map<string, string>();
  const runeOn = new Map<string, string>();
  const coreOn = new Map<string, string>();
  const charmOn = new Map<string, string>();
  for (const [wildId, l] of Object.entries(state.loadouts)) {
    if (l.relic) relicOn.set(l.relic, wildId);
    if (l.charm) charmOn.set(l.charm, wildId);
    for (const id of l.runes) if (id) runeOn.set(id, wildId);
    for (const id of l.cores) if (id) coreOn.set(id, wildId);
  }

  const relics: RelicView[] = state.equipment.relics.map((r) => {
    const def = tables.relics.find((d) => d.id === r.defId);
    return {
      instanceId: r.id,
      defId: r.defId,
      name: def?.name ?? r.defId,
      className: def?.className ?? 'striker',
      tier: def?.tier ?? 'common',
      level: r.level,
      refine: r.refine,
      maxLevel: tuning.relic.maxLevel,
      maxRefine: tuning.relic.maxRefine,
      effectText: def?.effect.text ?? '',
      levelCost: r.level >= tuning.relic.maxLevel ? null : relicLevelCost(r.level, tuning),
      refineCost: r.refine >= tuning.relic.maxRefine ? null : relicRefineCost(r.refine, tuning),
      equippedOn: relicOn.get(r.id) ?? null,
    };
  });

  const runes: RuneView[] = state.equipment.runes.map((r) => {
    const def = tables.runes.find((d) => d.id === r.defId);
    const setId = def?.setId ?? '';
    return {
      instanceId: r.id,
      defId: r.defId,
      name: def?.name ?? r.defId,
      setId,
      setName: tables.runeSets.find((s) => s.id === setId)?.name ?? setId,
      tier: def?.tier ?? 'common',
      level: r.level,
      maxLevel: tuning.runes.maxLevel,
      equippedOn: runeOn.get(r.id) ?? null,
    };
  });

  const runeSetCounts = new Map<string, number>();
  for (const id of loadout.runes) {
    const rune = id ? state.equipment.runes.find((r) => r.id === id) : undefined;
    const def = rune ? tables.runes.find((d) => d.id === rune.defId) : undefined;
    if (def) runeSetCounts.set(def.setId, (runeSetCounts.get(def.setId) ?? 0) + 1);
  }
  const runeSets = tables.runeSets.map((s) => ({
    id: s.id,
    name: s.name,
    pieces: s.pieces,
    equipped: runeSetCounts.get(s.id) ?? 0,
  }));

  const cores: CoreView[] = state.equipment.cores.map((c) => ({
    instanceId: c.id,
    setId: c.setId,
    name: tables.coreSets.find((s) => s.id === c.setId)?.name ?? c.setId,
    socket: c.socket,
    stars: c.stars,
    equippedOn: coreOn.get(c.id) ?? null,
  }));

  const charms: CharmView[] = tables.charms
    .filter((c) => (state.equipment.charms[c.id] ?? 0) > 0 || charmOn.has(c.id))
    .map((c) => ({
      defId: c.id,
      name: c.name,
      tier: c.tier,
      stars: state.equipment.charmStars[c.id] ?? 1,
      maxStars: c.maxStars,
      count: state.equipment.charms[c.id] ?? 0,
      equippedOn: charmOn.get(c.id) ?? null,
    }));

  const trees: TalentTreeOption[] = tables.talentTrees.map((t) => ({ id: t.id, name: t.name, className: t.className }));
  const tree = loadout.treeId ? tables.talentTrees.find((t) => t.id === loadout.treeId) : undefined;
  const talentTiers: TalentTierView[] = tree
    ? tree.tiers.map((options, tier) => ({
        tier,
        options: options.map((blockId, option) => ({
          blockId,
          text: tables.talentBlocks.find((b) => b.id === blockId)?.text ?? blockId,
          chosen: (loadout.talents[tier] ?? -1) === option,
        })),
      }))
    : [];

  const textMap = effectTextMap(tables);

  return {
    wildId: wild.id,
    sheet: baseSheet,
    sheetEquipped: mergeDelta(baseSheet, folded.delta),
    percent: folded.delta.percent,
    soul: folded.delta.soul,
    power: {
      base: basePower,
      equipped: powerOfSheet(mergeDelta(baseSheet, folded.delta), folded.delta.percent, config.power),
      layers: layerPower,
    },
    unlocks: {
      relic: meta ? relicUnlocked(meta.tier, tuning) : false,
      runes: runesUnlocked(wild.stars, tuning),
      charms: charmsUnlocked(wild.stars, tuning),
      cores: coresUnlocked(wild.stars, tuning),
      talents: meta ? talentsUnlocked(meta.tier, tuning) : false,
    },
    requirements: {
      relic: tuning.relic.minTier,
      runes: tuning.runes.minStars,
      charms: tuning.charms.minStars,
      cores: tuning.cores.minStars,
      talents: tuning.talents.minTier,
    },
    loadout,
    relics,
    runes,
    runeSets,
    cores,
    charms,
    trees,
    talentTiers,
    costs: {
      talentAllocateGold: tuning.talents.allocateGold,
      talentResetGems: tuning.talents.resetGems,
      charmUpgradeCopies: CHARM_UPGRADE_COPIES,
    },
    delta: folded.delta,
    layerDelta: folded.layers,
    effects: folded.effects.map((e) => {
      const base = { tag: e.tag, text: textMap.get(e.tag) ?? e.tag, fromRound: e.fromRound };
      return e.bigRounds ? { ...base, bigRounds: e.bigRounds } : base;
    }),
  };
}
