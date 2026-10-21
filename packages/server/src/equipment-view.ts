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
  runeLevelCost,
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
import type { PlateView } from './plates';
import { buildPlateView } from './plates';
import type { TrinketView } from './trinkets';
import { buildTrinketView } from './trinkets';
import { resonanceFoldFor } from './resonance';
import { sheetOf } from './battle';

/**
 * Display-ready equipment view (M7). Built server-side so the client never has to
 * re-derive rules; the client only renders and calls actions.
 */

/** Berry Essence to raise a Berry one star. */
export function charmUpgradeEssence(stars: number, collection: GameConfig['collection']): number {
  const { upgradeEssenceBase, upgradeEssencePerStar } = collection.berries;
  return upgradeEssenceBase + Math.max(0, stars - 1) * upgradeEssencePerStar;
}

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
  levelCost: { shards: number } | null;
  refineCost: { gold: number; shards: number } | null;
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
  /** Same-kind, same-level copies that are not socketed anywhere. */
  duplicates: number;
  levelCost: { gold: number; essence: number } | null;
}

export interface CoreView {
  instanceId: string;
  setId: string;
  name: string;
  socket: number;
  stars: number;
  maxStars: number;
  starCost: number | null;
  equippedOn: string | null;
}

export interface CoreSetView {
  id: string;
  name: string;
  equipped: number;
  bonuses: { pieces: number; active: boolean; text: string }[];
}

export interface CharmView {
  defId: string;
  name: string;
  tier: string;
  stars: number;
  maxStars: number;
  count: number;
  equippedOn: string[];
  upgradeCopies: number;
  upgradeEssence: number | null;
  dismantleEssence: number;
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
  sheetEquipped: SheetInput;  /** Equipped percent lines, for the stat sheet. */
  percent: Partial<PercentLines>;
  /** Equipped soul stats, for the stat sheet. */
  soul: Partial<SoulStats>;
  power: EquipmentPowerView;
  unlocks: { relic: boolean; runes: boolean; charms: boolean; cores: boolean; talents: boolean };
  requirements: { relic: Tier; runes: number; charms: number; cores: number; talents: Tier };
  loadout: Loadout;
  relics: RelicView[];
  runes: RuneView[];
  runeSets: { id: string; name: string; equipped: number; bonuses: { pieces: number; active: boolean }[] }[];
  cores: CoreView[];
  coreSets: CoreSetView[];
  orbEssence: number;
  soulHeartExp: number;
  berryEssence: number;
  heldItemShards: number;
  plateBottles: number;
  plateFragments: number;
  starShards: number;
  charmSlots: number;
  charms: CharmView[];
  trees: TalentTreeOption[];
  talentTiers: TalentTierView[];
  /** Duplicate copies of this species available as Potential fodder. */
  fodderCount: number;
  potentialShards: number;
  /** Shards refunded by a full Potential reset (fodder is not refunded). */
  talentResetRefund: number;
  costs: {
    talentShardBase: number;
    talentShardPerTier: number;
    talentRespecShards: number;
    talentFodderPerTier: number;
    talentResetGems: number;
    runeCopiesPerLevel: number;
    charmUpgradeCopies: number;
  };
  delta: StatDelta;
  layerDelta: Record<keyof LayerDelta, StatDelta>;
  effects: { tag: string; text: string; fromRound: number; bigRounds?: number }[];
  /** M11.7 element-keyed plate card. */
  plate: PlateView;
  /** M11.8 species-signature trinket card. */
  trinket: TrinketView;
}

/** The loadout for a Wild, synthesising an empty one when none is stored. */
export function loadoutOf(state: AccountState, wildId: string, tables: EquipmentTables): Loadout {
  return state.loadouts[wildId] ?? emptyLoadout(tables.tuning);
}

/**
 * Duplicate copies that may be fed to Potential. The target, locked Wilds and
 * every squad member are protected; the cheapest (lowest level, then stars) copy
 * is listed first so the server's automatic pick is predictable.
 */
export function potentialFodder(state: AccountState, wild: WildInstance): WildInstance[] {
  const inSquad = new Set<string>();
  for (const squad of Object.values(state.squads)) {
    for (const id of squad) if (id) inSquad.add(id);
  }
  return state.roster
    .filter(
      (copy) =>
        copy.id !== wild.id &&
        copy.speciesId === wild.speciesId &&
        !copy.locked &&
        !inSquad.has(copy.id),
    )
    .sort((a, b) => a.level - b.level || a.stars - b.stars || a.id.localeCompare(b.id));
}

/** Potential Shards charged for a tier; re-picks use the flat respec fee. */
export function talentShardCost(
  tier: number,
  collection: GameConfig['collection'],
  respec: boolean,
): number {
  return respec ? collection.potential.respecShardFee : collection.potential.shardBase + tier * collection.potential.shardPerTier;
}

/** Shards returned by a full reset: every sequential tier that was bought. */
export function talentResetRefund(loadout: Loadout, collection: GameConfig['collection']): number {
  const spent = loadout.talents.filter((value) => value >= 0).length;
  let refund = 0;
  for (let tier = 0; tier < spent; tier += 1) {
    refund += collection.potential.shardBase + tier * collection.potential.shardPerTier;
  }
  return refund;
}

/** Orb Essence that replaces the duplicate copies for a level-up. */
export function orbEssenceCost(level: number, collection: GameConfig['collection']): number {
  return collection.orbs.essenceBase + Math.max(0, level - 1) * collection.orbs.essencePerLevel;
}

/** Soul-heart EXP for the next star: base + (stars − 1) × perStar. */
export function soulHeartCost(stars: number, collection: GameConfig['collection']): number {
  return collection.soulhearts.expBase + Math.max(0, stars - 1) * collection.soulhearts.expPerStar;
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
  const folded = foldLoadout(
    loadout,
    state.equipment,
    tables,
    meta ? { faction: meta.faction, stage: state.plates[wild.id] ?? 0 } : undefined,
    { speciesId: wild.speciesId, level: state.trinkets?.[wild.speciesId] ?? 0 },
    resonanceFoldFor(config, state, wild.id),
  );
  const baseSheet = sheetOf(wild, config) ?? { hp: 0, pAtk: 0, sAtk: 0, spd: 0, pDef: 0, sDef: 0 };
  const basePower = powerOfSheet(baseSheet, {}, config.power);
  const layerKeys: (keyof LayerDelta)[] = [
    'relic',
    'plates',
    'trinkets',
    'resonance',
    'runes',
    'charms',
    'cores',
    'talents',
  ];
  const layerPower = {} as Record<keyof LayerDelta, number>;
  for (const key of layerKeys) {
    const delta = folded.layers[key];
    const merged = mergeDelta(baseSheet, delta);
    layerPower[key] = powerOfSheet(merged, delta.percent, config.power) - basePower;
  }

  const relicOn = new Map<string, string>();
  const runeOn = new Map<string, string>();
  const coreOn = new Map<string, string>();
  const charmOn = new Map<string, string[]>();
  for (const [wildId, l] of Object.entries(state.loadouts)) {
    if (l.relic) relicOn.set(l.relic, wildId);
    for (const id of l.charms) {
      if (!id) continue;
      charmOn.set(id, [...(charmOn.get(id) ?? []), wildId]);
    }
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

  const wornRunes = new Set(runeOn.keys());
  const runes: RuneView[] = state.equipment.runes.map((r) => {
    const def = tables.runes.find((d) => d.id === r.defId);
    const setId = def?.setId ?? '';
    const duplicates = state.equipment.runes.filter(
      (copy) => copy.id !== r.id && copy.defId === r.defId && copy.level === r.level && !wornRunes.has(copy.id),
    ).length;
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
      duplicates,
      levelCost:
        r.level >= tuning.runes.maxLevel
          ? null
          : { gold: runeLevelCost(r.level, tuning).gold, essence: orbEssenceCost(r.level, config.collection) },
    };
  });

  const runeSetCounts = new Map<string, number>();
  for (const id of loadout.runes) {
    const rune = id ? state.equipment.runes.find((r) => r.id === id) : undefined;
    const def = rune ? tables.runes.find((d) => d.id === rune.defId) : undefined;
    if (def) runeSetCounts.set(def.setId, (runeSetCounts.get(def.setId) ?? 0) + 1);
  }
  const runeSets = tables.runeSets.map((s) => {
    const equipped = runeSetCounts.get(s.id) ?? 0;
    return {
      id: s.id,
      name: s.name,
      equipped,
      bonuses: s.bonuses.map((bonus) => ({ pieces: bonus.pieces, active: equipped >= bonus.pieces })),
    };
  });

  const cores: CoreView[] = state.equipment.cores.map((c) => ({
    instanceId: c.id,
    setId: c.setId,
    name: tables.coreSets.find((s) => s.id === c.setId)?.name ?? c.setId,
    socket: c.socket,
    stars: c.stars,
    maxStars: tuning.cores.pieceMaxStars,
    starCost: c.stars >= tuning.cores.pieceMaxStars ? null : soulHeartCost(c.stars, config.collection),
    equippedOn: coreOn.get(c.id) ?? null,
  }));

  const coreSetCounts = new Map<string, number>();
  for (const id of loadout.cores) {
    const core = id ? state.equipment.cores.find((c) => c.id === id) : undefined;
    if (core) coreSetCounts.set(core.setId, (coreSetCounts.get(core.setId) ?? 0) + 1);
  }
  const coreSets: CoreSetView[] = tables.coreSets.map((set) => {
    const equipped = coreSetCounts.get(set.id) ?? 0;
    return {
      id: set.id,
      name: set.name,
      equipped,
      bonuses: set.bonuses.map((bonus) => ({
        pieces: bonus.pieces,
        active: equipped >= bonus.pieces,
        text: bonus.text ?? bonus.soulheart?.text ?? bonus.effect?.text ?? `${bonus.pieces}-piece bonus`,
      })),
    };
  });

  const charms: CharmView[] = tables.charms
    .filter((c) => (state.equipment.charms[c.id] ?? 0) > 0 || charmOn.has(c.id))
    .map((c) => {
      const stars = state.equipment.charmStars[c.id] ?? 1;
      return {
        defId: c.id,
        name: c.name,
        tier: c.tier,
        stars,
        maxStars: c.maxStars,
        count: state.equipment.charms[c.id] ?? 0,
        equippedOn: charmOn.get(c.id) ?? [],
        upgradeCopies: config.collection.berries.upgradeCopies,
        upgradeEssence: c.maxStars > 0 && stars < c.maxStars ? charmUpgradeEssence(stars, config.collection) : null,
        dismantleEssence: config.collection.berries.dismantleEssence[c.tier],
      };
    });

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
    coreSets,
    orbEssence: state.currencies.orbEssence ?? 0,
    soulHeartExp: state.currencies.soulHeartExp ?? 0,
    berryEssence: state.currencies.berryEssence ?? 0,
    heldItemShards: state.currencies.heldItemShard ?? 0,
    plateBottles: state.currencies.plateBottle ?? 0,
    plateFragments: state.currencies.plateFragment ?? 0,
    starShards: state.currencies.starShard ?? 0,
    charmSlots: tuning.charms.slots,
    charms,
    trees,
    talentTiers,
    fodderCount: potentialFodder(state, wild).length,
    potentialShards: state.currencies.potentialShard ?? 0,
    talentResetRefund: talentResetRefund(loadout, config.collection),
    costs: {
      talentShardBase: config.collection.potential.shardBase,
      talentShardPerTier: config.collection.potential.shardPerTier,
      talentRespecShards: config.collection.potential.respecShardFee,
      talentFodderPerTier: config.collection.potential.fodderPerTier,
      talentResetGems: config.collection.potential.resetGems,
      runeCopiesPerLevel: config.collection.orbs.copiesPerLevel,
      charmUpgradeCopies: config.collection.berries.upgradeCopies,
    },
    delta: folded.delta,
    layerDelta: folded.layers,
    effects: folded.effects.map((e) => {
      const base = { tag: e.tag, text: textMap.get(e.tag) ?? e.tag, fromRound: e.fromRound };
      return e.bigRounds ? { ...base, bigRounds: e.bigRounds } : base;
    }),
    plate: buildPlateView(config, state, wild),
    trinket: buildTrinketView(config, state, wild),
  };
}
