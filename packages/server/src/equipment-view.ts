import {
  charmsUnlocked,
  computePower,
  coresUnlocked,
  emptyLoadout,
  foldLoadout,
  mergeDelta,
  heldDismantleShards,
  heldLevelCost,
  heldLevelGate,
  heldMaxLevel,
  heldMaxRefine,
  heldRefineCost,
  HELD_SCALE,
  lineRow,
  mainRows,
  mainValue,
  refineBlock,
  relicUnlocked,
  type EquipmentTables,
  type LayerDelta,
  type Loadout,
  type PercentLines,
  type SheetInput,
  type SoulStats,
  type StatDelta,
  type Tier,
  type Faction,
  type WildClass,
  coreMaxStars,
  coreStarCost,
  type CoreQuality,
} from '@wildbound/engine';
import type { AccountState, WildInstance } from '@wildbound/engine';
import type { GameConfig } from './config';
import type { PlateView } from './plates';
import { buildPlateView } from './plates';
import type { TrinketView } from './trinkets';
import { buildTrinketView } from './trinkets';
import { resonanceFoldFor } from './resonance';
import { titleFoldFor } from './titles';
import { applySheetPercents, sheetOf } from './battle';

/**
 * Display-ready equipment view (M7). Built server-side so the client never has to
 * re-derive rules; the client only renders and calls actions.
 */

/** Berry Essence to raise a Berry one star. */
export function charmUpgradeEssence(stars: number, collection: GameConfig['collection']): number {
  const { upgradeEssenceBase, upgradeEssencePerStar } = collection.berries;
  return upgradeEssenceBase + Math.max(0, stars - 1) * upgradeEssencePerStar;
}

/** One rolled line on a held item; values are the source's per-ten-thousand numbers. */
export interface HeldLineView {
  slot: number;
  name: string;
  value: number;
  min: number;
  max: number;
  /** Set on the 20 faction lines: they count only on a Pokémon of that faction. */
  faction: Faction | null;
  /** Whether the line counts on the Wild this view is for. */
  counts: boolean;
  refines: number;
  /** Whether this slot can be refined now (ignores the price). */
  refinable: boolean;
}

export interface RelicView {
  instanceId: string;
  defId: string;
  name: string;
  className: WildClass;
  tier: Tier;
  level: number;
  maxLevel: number;
  /** Main stat at this level: flat value, plus "Total %" (per ten-thousand) from Legendary. */
  main: { name: string; value: number; percent: boolean }[];
  lines: HeldLineView[];
  pending: { slot: number; name: string; value: number; min: number; max: number } | null;
  /** `standIn` names a number the source text leaves out and the value used. */
  skill: { name: string; text: string; active: boolean; standIn: string | null } | null;
  refines: number;
  maxRefine: number;
  refineSlots: number;
  refineSlotsUsed: number;
  /** Held Item Resetters for the next refine (0 = free), or null when none are left. */
  refineCost: number | null;
  /** Held Item Shards for the next level, or null at the cap. */
  levelCost: number | null;
  /** Resonance (Link Crystal) level the next level needs; 0 = none. */
  levelGate: number;
  locked: boolean;
  dismantleShards: number;
  equippedOn: string | null;
}

export interface CoreView {
  instanceId: string;
  quality: CoreQuality;
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
  unlocks: { relic: boolean; charms: boolean; cores: boolean };
  requirements: { relic: Tier; charms: number; cores: number };
  loadout: Loadout;
  relics: RelicView[];
  cores: CoreView[];
  coreSets: CoreSetView[];
  orbEssence: number;
  soulHeartExp: number;
  berryEssence: number;
  heldItemShards: number;
  resetterShards: number;
  heldItemResetters: number;
  /** Resetter Shards per Held Item Resetter. */
  resetterCompound: number;
  /** Account resonance (Link Crystal) level, for the held-item level gates. */
  resonanceLevel: number;
  /** Divide held-item values by this to get a fraction (1,067 → 10.67%). */
  heldScale: number;
  plateBottles: number;
  plateFragments: number;
  starShards: number;
  charmSlots: number;
  charms: CharmView[];
  costs: {
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



/** Which Wild (if any) currently wears an instance — scan every stored loadout. */
export function equippedOn(state: AccountState, instanceId: string): string | null {
  for (const [wildId, loadout] of Object.entries(state.loadouts)) {
    if (loadout.relic === instanceId) return wildId;
    if (loadout.orbs.some((id) => id === instanceId)) return wildId;
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
  for (const relic of tables.relics) for (const fx of relic.skill?.effects ?? []) map.set(fx.tag, relic.skill!.text);
  for (const set of tables.coreSets) for (const bonus of set.bonuses) if (bonus.effect) map.set(bonus.effect.tag, bonus.effect.text);
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
    titleFoldFor(config, state),
  );
  const baseSheet = sheetOf(wild, config) ?? { hp: 0, pAtk: 0, sAtk: 0, spd: 0, pDef: 0, sDef: 0 };
  const basePower = powerOfSheet(baseSheet, {}, config.power);
  const layerKeys: (keyof LayerDelta)[] = [
    'relic',
    'plates',
    'trinkets',
    'resonance',
    'titles',
    'runes',
    'charms',
    'cores',
  ];
  const layerPower = {} as Record<keyof LayerDelta, number>;
  for (const key of layerKeys) {
    const delta = folded.layers[key];
    const merged = applySheetPercents(mergeDelta(baseSheet, delta), delta.percent);
    layerPower[key] = powerOfSheet(merged, delta.percent, config.power) - basePower;
  }

  const relicOn = new Map<string, string>();
  const coreOn = new Map<string, string>();
  const charmOn = new Map<string, string[]>();
  for (const [wildId, l] of Object.entries(state.loadouts)) {
    if (l.relic) relicOn.set(l.relic, wildId);
    for (const id of l.charms) {
      if (!id) continue;
      charmOn.set(id, [...(charmOn.get(id) ?? []), wildId]);
    }
    for (const id of l.cores) if (id) coreOn.set(id, wildId);
  }

  const held = tables.held;
  const relics: RelicView[] = [];
  for (const r of state.equipment.relics) {
    const def = tables.relics.find((d) => d.id === r.defId);
    if (!def) continue;
    const refineSlotsUsed = r.lines.filter((l) => l.refines > 0).length;
    const pendingRow = r.pending ? lineRow(held, r.pending.index) : undefined;
    relics.push({
      instanceId: r.id,
      defId: r.defId,
      name: def.name,
      className: def.className,
      tier: def.tier,
      level: r.level,
      maxLevel: heldMaxLevel(held),
      main: mainRows(def, held, r.group).map((row) => ({
        name: row.name,
        value: mainValue(row, r.level),
        percent: row.kind === 'percent',
      })),
      lines: r.lines.map((line, slot) => {
        const row = lineRow(held, line.index);
        return {
          slot,
          name: row?.name ?? String(line.index),
          value: line.value,
          min: row?.min ?? 0,
          max: row?.max ?? 0,
          faction: row?.faction ?? null,
          counts: !row?.faction || row.faction === meta?.faction,
          refines: line.refines,
          refinable: refineBlock(r, def, held, slot) === null,
        };
      }),
      pending:
        r.pending && pendingRow
          ? { slot: r.pending.slot, name: pendingRow.name, value: r.pending.value, min: pendingRow.min, max: pendingRow.max }
          : null,
      skill: def.skill
        ? { name: def.skill.name, text: def.skill.text, active: def.skill.active, standIn: def.skill.standIn ?? null }
        : null,
      refines: r.refines,
      maxRefine: heldMaxRefine(held),
      refineSlots: def.refineSlots,
      refineSlotsUsed,
      refineCost: def.refineSlots > 0 ? heldRefineCost(r, held) : null,
      levelCost: heldLevelCost(r.level, held),
      levelGate: heldLevelGate(r.level, held),
      locked: r.locked,
      dismantleShards: heldDismantleShards(r, def, held),
      equippedOn: relicOn.get(r.id) ?? null,
    });
  }

  const cores: CoreView[] = state.equipment.cores.map((c) => ({
    instanceId: c.id,
    setId: c.setId,
    name: tables.coreSets.find((s) => s.id === c.setId)?.name ?? c.setId,
    socket: c.socket,
    stars: c.stars,
    quality: c.quality,
    maxStars: coreMaxStars(c, tuning),
    starCost: coreStarCost(c, tuning),
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

  const textMap = effectTextMap(tables);

  return {
    wildId: wild.id,
    sheet: baseSheet,
    sheetEquipped: applySheetPercents(mergeDelta(baseSheet, folded.delta), folded.delta.percent),
    percent: folded.delta.percent,
    soul: folded.delta.soul,
    power: {
      base: basePower,
      equipped: powerOfSheet(
        applySheetPercents(mergeDelta(baseSheet, folded.delta), folded.delta.percent),
        folded.delta.percent,
        config.power,
      ),
      layers: layerPower,
    },
    unlocks: {
      relic: meta ? relicUnlocked(meta.tier, tuning) : false,
      charms: charmsUnlocked(wild.stars, tuning),
      cores: coresUnlocked(wild.stars, tuning),
    },
    requirements: {
      relic: tuning.relic.minTier,
      charms: tuning.charms.minStars,
      cores: tuning.cores.minStars,
    },
    loadout,
    relics,
    cores,
    coreSets,
    orbEssence: state.currencies.orbEssence ?? 0,
    soulHeartExp: state.currencies.soulHeartExp ?? 0,
    berryEssence: state.currencies.berryEssence ?? 0,
    heldItemShards: state.currencies.heldItemShard ?? 0,
    resetterShards: state.currencies.resetterShard ?? 0,
    heldItemResetters: state.currencies.heldItemResetter ?? 0,
    resetterCompound: held.resetterCompound,
    resonanceLevel: state.pve.linkCrystal.level,
    heldScale: HELD_SCALE,
    plateBottles: state.currencies.plateBottle ?? 0,
    plateFragments: state.currencies.plateFragment ?? 0,
    starShards: state.currencies.starShard ?? 0,
    charmSlots: tuning.charms.slots,
    charms,
    costs: {
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
