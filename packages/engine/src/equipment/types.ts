import { ORB_SOCKETS, type OrbInstance, type OrbTables } from './orbs';
import type { CombatField, DamageMod, RoundEffect, SoulheartHooks, TriggerDef } from '../combat/types';
import type { CoreStats, PercentLines, SoulStats, Tier, WildClass, Faction } from '../model';

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

/** A Soul-heart set hook plus the sentence the gear screen shows. */
export interface SoulheartEffectDef extends SoulheartHooks {
  text: string;
}

/** A held item's skill (Legendary tier I, Supreme/Mythic tier II), copied from the source. */
export interface HeldSkillDef {
  id: string;
  name: string;
  text: string;
  /** False when the battle engine can't express it yet; the text still shows. */
  active: boolean;
  /** Round-start stat changes (Choice Specs, Razor Fang…). */
  effects: RoundEffect[];
  /** E2: event triggers (Light Clay, Scope Lens…). */
  triggers?: TriggerDef[];
  /** E2: damage modifiers (Wide Lens, Heat Rock…). */
  damageMods?: DamageMod[];
  /** A number the source text leaves out, and the value used instead. */
  standIn?: string;
}

/** One of the source's 75 held items (code id: relic). See equipment/held.ts. */
export interface RelicDef {
  id: string;
  name: string;
  className: WildClass;
  tier: Tier;
  mainPool: number;
  linePool: number;
  lineCount: number;
  /** How many line slots can ever be refined (Supreme 2, Mythic 3). */
  refineSlots: number;
  /** Held Item Shards paid on dismantle. */
  dismantle: number;
  skill: HeldSkillDef | null;
}

/** A main-stat row; `value + ⌊level / every⌋ × step` (percent rows per ten-thousand). */
export interface HeldMainRow {
  index: number;
  pool: number;
  group: number;
  weight: number;
  name: string;
  kind: 'core' | 'percent';
  field: string;
  value: number;
  every: number;
  step: number;
}

/** A random-line row (per ten-thousand); a faction line counts only on that faction. */
export interface HeldLineRow {
  index: number;
  pool: number;
  weight: number;
  name: string;
  kind: 'percent' | 'lifesteal';
  field: string;
  faction?: Faction;
  min: number;
  max: number;
}

export interface HeldTables {
  mainPool: HeldMainRow[];
  linePool: HeldLineRow[];
  /** Held Item Shards for level n → n + 1 (index n). */
  levelCost: number[];
  levelGates: { level: number; resonance: number }[];
  /** Held Item Resetters per refine (owner's ladder). */
  refineLadder: number[];
  /** Resetter Shards per Held Item Resetter. */
  resetterCompound: number;
}

/** One element-keyed plate per faction; stage 0 is empty. */
/** R6a: the source's plates — one stat table for all 54, named by the Pokémon's card type. */
export interface PlateTables {
  unlock: { playerLevel: number; stars: number };
  plates: { id: number; name: string }[];
  /** Stage 0–18 stats (`hpPct` = Total HP, a fraction). */
  stages: { stage: number; hp: number; pAtk: number; sAtk: number; hpPct: number }[];
  /** Price of stage N → N + 1, and the Pokémon level it needs (0 = none). */
  steps: { currency: 'plateBottle' | 'plateFragment'; amount: number; level: number }[];
  skillSwapStage: number;
  /** Per species: [from star, plate id] runs. */
  species: Record<string, [number, number][]>;
}

/**
 * R6b: an exclusive trinket (source hero_weapon / hero_weapon_cost). `levels[n]` holds the stats at level n
 * (flat lines: `base` is the value, `perLevel` 0) and the price of n → n + 1 (null at the cap). Level 0 is empty.
 */
export interface TrinketLevelDef {
  rank: number;
  lines: StatLine[];
  cost: { starShard: number; item: number } | null;
}

export interface TrinketDef {
  id: string;
  name: string;
  speciesId: string;
  sourceId: number;
  /** The holder's own levelling item (Star Shards are paid at every level, this at 9 / 19 / 29 / 39). */
  item: { id: number; name: string };
  levels: TrinketLevelDef[];
  /** The skills at Lv 10 / 20 / 30 / 40 (ported in R6b part 2). */
  skills: { level: number; skillId: number }[];
}

export interface TrinketTables {
  unlock: { rosterCount: number; rosterLevel: number; stars: number };
  maxLevel: number;
  trinkets: TrinketDef[];
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
  /** Human-readable set-bonus sentence (authored data, shown by the screen). */
  text?: string;
  /** M11.4 dynamic effect; same-stat ladders take the highest reached value. */
  soulheart?: SoulheartEffectDef;
}

export interface CoreSetDef {
  id: string;
  name: string;
  /** Six socket templates; each is scaled by the piece's stars (2–5). */
  socketLines: StatLine[][];
  bonuses: CoreSetBonus[];
}


// --- owned instances -------------------------------------------------------

export interface HeldLine {
  /** Row in the line pool. */
  index: number;
  value: number;
  /** How often this slot has been refined. */
  refines: number;
}

export interface RelicInstance {
  id: string;
  defId: string;
  level: number;
  /** Main-stat group (1 HP, 2 P.ATK, 3 S.ATK). */
  group: number;
  lines: HeldLine[];
  /** Refines paid on this item (prices the next one). */
  refines: number;
  /** A refine roll not yet kept or dropped. */
  pending: { slot: number; index: number; value: number } | null;
  locked: boolean;
}


/** R6c: the source's four Soul-heart qualities (item qualities 3–6), capped at 2 / 3 / 4 / 5 stars. */
export type CoreQuality = 'blue' | 'purple' | 'orange' | 'red';

export interface CoreInstance {
  id: string;
  setId: string;
  socket: number;
  quality: CoreQuality;
  /** 0 … the quality's cap (source: each star its own EXP step). */
  stars: number;
}

/** What a single Wild wears. Empty string ids are not used — `null` means empty. */
export interface Loadout {
  relic: string | null;
  /** R3: eight orb sockets — 0–3 row 1 on gear pieces 1–4, 4–7 row 2. */
  orbs: (string | null)[];
  charms: (string | null)[];
  cores: (string | null)[];
}

// --- tuning ----------------------------------------------------------------

export interface EquipmentTuning {
  relic: { minTier: Tier };
  charms: { minStars: number; slots: number };
  cores: {
    minStars: number;
    sockets: number;
    /** R6c: star cap per quality (blue 2, purple 3, orange 4, red 5). */
    qualityStars: Record<CoreQuality, number>;
    /** R6c: Soul-heart EXP for each star step, per quality (hero_heart_soul_up_star_json). */
    starExp: Record<CoreQuality, number[]>;
  };
  starting: StartingEquipment;
}

export interface StartingEquipment {
  relics: { defId: string }[];
  cores: { setId: string; socket: number; quality: CoreQuality; stars: number }[];
  charms: { defId: string; stars: number; count: number }[];
}

/** The account's owned equipment: instance lists + charm counts and star levels. */
export interface EquipmentState {
  relics: RelicInstance[];
  orbs: OrbInstance[];
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
  held: HeldTables;
  plates: PlateTables;
  trinkets: TrinketDef[];
  /** R6b: the trinket unlock and level cap (trinkets.json). */
  trinketRules: Omit<TrinketTables, 'trinkets'>;
  orbs: OrbTables;
  charms: CharmDef[];
  coreSets: CoreSetDef[];
  tuning: EquipmentTuning;
}

export function emptyLoadout(tuning: EquipmentTuning): Loadout {
  return {
    relic: null,
    orbs: Array.from({ length: ORB_SOCKETS }, () => null),
    charms: Array.from({ length: tuning.charms.slots }, () => null),
    cores: Array.from({ length: tuning.cores.sockets }, () => null),
  };
}

export function emptyDelta(): StatDelta {
  return { core: {}, percent: {}, soul: {} };
}

export function emptyStartingEquipment(): StartingEquipment {
  return { relics: [], cores: [], charms: [] };
}

/**
 * Build the owned-inventory slice of an account from the tuning `starting` list. Held items need
 * their lines rolled, so `rollRelic` is passed in by the caller (omitted = none granted).
 */
export function initialEquipment(
  starting: StartingEquipment,
  rollRelic?: (defId: string, id: string) => RelicInstance | null,
): EquipmentState {
  const state: EquipmentState = { relics: [], orbs: [], cores: [], charms: {}, charmStars: {}, nextSeq: 1 };
  for (const r of starting.relics) {
    const inst = rollRelic?.(r.defId, `re${state.nextSeq}`);
    if (!inst) continue;
    state.nextSeq += 1;
    state.relics.push(inst);
  }
  for (const c of starting.cores) {
    state.cores.push({ id: `co${state.nextSeq++}`, setId: c.setId, socket: c.socket, quality: c.quality, stars: c.stars });
  }
  for (const c of starting.charms) {
    state.charms[c.defId] = (state.charms[c.defId] ?? 0) + c.count;
    state.charmStars[c.defId] = Math.max(state.charmStars[c.defId] ?? 1, c.stars);
  }
  return state;
}

/** A percent-effect key that combat understands, kept as a plain `CombatField`. */
export type EffectField = CombatField;
