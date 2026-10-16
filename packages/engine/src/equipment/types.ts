import type { CombatField, RoundEffect } from '../combat/types';
import type { CoreStats, PercentLines, SoulStats, Tier, WildClass } from '../model';

/**
 * Equipment layers (M7, PROMPT §7.3). Types + rule inputs only: the engine stays
 * pure, so callers pass the content tables (`EquipmentTables`) in. See
 * docs/design/equipment.md.
 */

export type CoreStatField = keyof CoreStats;
export type PercentField = keyof PercentLines;
export type SoulField = keyof SoulStats;
export type StatField = CoreStatField | PercentField | SoulField;
export type StatKind = 'core' | 'percent' | 'soul';

/** One authored line: `base + perLevel × (value − 1)`, value = level/stars. */
export interface StatLine {
  kind: StatKind;
  field: string;
  base: number;
  perLevel: number;
}

/** A folded set of lines, ready to merge into a combat `SheetInput`. */
export interface StatDelta {
  core: Partial<CoreStats>;
  percent: Partial<PercentLines>;
  soul: Partial<SoulStats>;
}

/** A conditional in-battle effect plus the text the UI shows for it. */
export interface EffectDef extends RoundEffect {
  text: string;
}

export interface RelicDef {
  id: string;
  name: string;
  className: WildClass;
  tier: Tier;
  lines: StatLine[];
  effect: EffectDef;
}

export interface RuneDef {
  id: string;
  name: string;
  setId: string;
  tier: Tier;
  lines: StatLine[];
}

export interface RuneSetDef {
  id: string;
  name: string;
  pieces: number;
  lines: StatLine[];
}

export type CharmTier = 'common' | 'basic' | 'intermediate' | 'greater';

export interface CharmDef {
  id: string;
  name: string;
  tier: CharmTier;
  /** Commons are fixed (0); higher tiers scale with stars. */
  maxStars: number;
  lines: StatLine[];
}

export interface CoreSetBonus {
  pieces: number;
  lines: StatLine[];
  effect?: EffectDef;
}

export interface CoreSetDef {
  id: string;
  name: string;
  /** Six socket templates; each is scaled by the piece's stars (2–5). */
  socketLines: StatLine[][];
  bonuses: CoreSetBonus[];
}

export interface TalentBlockDef {
  id: string;
  text: string;
  lines: StatLine[];
  effect?: EffectDef;
}

export interface TalentTreeDef {
  id: string;
  name: string;
  className: WildClass;
  /** Nine tiers, each three reusable block ids. */
  tiers: string[][];
}

// --- owned instances -------------------------------------------------------

export interface RelicInstance {
  id: string;
  defId: string;
  level: number;
  refine: number;
}

export interface RuneInstance {
  id: string;
  defId: string;
  level: number;
}

export interface CoreInstance {
  id: string;
  setId: string;
  socket: number;
  stars: number;
}

/** What a single Wild wears. Empty string ids are not used — `null` means empty. */
export interface Loadout {
  relic: string | null;
  runes: (string | null)[];
  charm: string | null;
  cores: (string | null)[];
  treeId: string | null;
  talents: number[];
}

// --- tuning ----------------------------------------------------------------

export interface EquipmentTuning {
  relic: { minTier: Tier; maxLevel: number; maxRefine: number };
  runes: { minStars: number; sockets: number; maxLevel: number };
  charms: { minStars: number; slots: number };
  cores: { minStars: number; sockets: number; pieceMinStars: number; pieceMaxStars: number };
  talents: { minTier: Tier; tiers: number; optionsPerTier: number; resetGems: number; allocateGold: number };
  relicLevelCost: { gold: number; candy: number; goldPerLevel: number; candyPerLevel: number };
  relicRefineCost: { gold: number; stone: number; goldPerRefine: number; stonePerRefine: number };
  runeLevelCost: { gold: number; goldPerLevel: number };
  starting: StartingEquipment;
}

export interface StartingEquipment {
  relics: { defId: string; level: number; refine: number }[];
  runes: { defId: string; level: number }[];
  cores: { setId: string; socket: number; stars: number }[];
  charms: { defId: string; stars: number; count: number }[];
}

/** The account's owned equipment: instance lists + charm counts and star levels. */
export interface EquipmentState {
  relics: RelicInstance[];
  runes: RuneInstance[];
  cores: CoreInstance[];
  /** charm defId → owned count. */
  charms: Record<string, number>;
  /** charm defId → star level (Commons stay at 1). */
  charmStars: Record<string, number>;
  /** Monotonic id source for new relic/rune/core instances. */
  nextSeq: number;
}

/** Everything the engine needs to apply the five layers. */
export interface EquipmentTables {
  relics: RelicDef[];
  runes: RuneDef[];
  runeSets: RuneSetDef[];
  charms: CharmDef[];
  coreSets: CoreSetDef[];
  talentBlocks: TalentBlockDef[];
  talentTrees: TalentTreeDef[];
  tuning: EquipmentTuning;
}

export function emptyLoadout(tuning: EquipmentTuning): Loadout {
  return {
    relic: null,
    runes: Array.from({ length: tuning.runes.sockets }, () => null),
    charm: null,
    cores: Array.from({ length: tuning.cores.sockets }, () => null),
    treeId: null,
    talents: Array.from({ length: tuning.talents.tiers }, () => -1),
  };
}

export function emptyDelta(): StatDelta {
  return { core: {}, percent: {}, soul: {} };
}

export function emptyStartingEquipment(): StartingEquipment {
  return { relics: [], runes: [], cores: [], charms: [] };
}

/** Build the owned-inventory slice of an account from the tuning `starting` list. */
export function initialEquipment(starting: StartingEquipment): EquipmentState {
  const state: EquipmentState = { relics: [], runes: [], cores: [], charms: {}, charmStars: {}, nextSeq: 1 };
  for (const r of starting.relics) {
    state.relics.push({ id: `re${state.nextSeq++}`, defId: r.defId, level: r.level, refine: r.refine });
  }
  for (const r of starting.runes) {
    state.runes.push({ id: `ru${state.nextSeq++}`, defId: r.defId, level: r.level });
  }
  for (const c of starting.cores) {
    state.cores.push({ id: `co${state.nextSeq++}`, setId: c.setId, socket: c.socket, stars: c.stars });
  }
  for (const c of starting.charms) {
    state.charms[c.defId] = (state.charms[c.defId] ?? 0) + c.count;
    state.charmStars[c.defId] = Math.max(state.charmStars[c.defId] ?? 1, c.stars);
  }
  return state;
}

/** A percent-effect key that combat understands, kept as a plain `CombatField`. */
export type EffectField = CombatField;
