import type { DamageMod, RoundEffect, SoulheartHooks, TriggerDef } from '../combat/types';
import { foldOrbs } from './orbs';
import { heldDelta } from './held';
import type { SheetInput } from '../combat/types';
import type { CoreStats, PercentLines, SoulStats } from '../model';
import type { Faction } from '../model';
import {
  emptyDelta,
  type CoreInstance,
  type EquipmentState,
  type EquipmentTables,
  type Loadout,
  type RelicInstance,
  type StatDelta,
  type StatLine,
} from './types';

/**
 * Fold owned equipment into one `StatDelta` + a list of conditional round effects
 * (M7, PROMPT §7.3). Every layer is additive; the server merges the delta into the
 * combat sheet and forwards the effects as `SpecInput.roundEffects`.
 */

/** `base + perLevel × (value − 1)`; `value` = level, stars, or 1 for static lines. */
export function lineValue(line: StatLine, value: number): number {
  return line.base + line.perLevel * Math.max(0, value - 1);
}

export function addLine(delta: StatDelta, line: StatLine, value: number): void {
  const v = lineValue(line, value);
  if (line.kind === 'core') {
    const field = line.field as keyof CoreStats;
    delta.core[field] = (delta.core[field] ?? 0) + v;
  } else if (line.kind === 'percent') {
    const field = line.field as keyof PercentLines;
    delta.percent[field] = (delta.percent[field] ?? 0) + v;
  } else {
    const field = line.field as keyof SoulStats;
    delta.soul[field] = (delta.soul[field] ?? 0) + v;
  }
}

export function addLines(delta: StatDelta, lines: StatLine[], value: number): void {
  for (const line of lines) addLine(delta, line, value);
}

/** Combine `src` into `target` (core/percent/soul added field by field). */
export function addDelta(target: StatDelta, src: StatDelta): StatDelta {
  for (const [k, v] of Object.entries(src.core)) {
    const field = k as keyof CoreStats;
    target.core[field] = (target.core[field] ?? 0) + (v as number);
  }
  for (const [k, v] of Object.entries(src.percent)) {
    const field = k as keyof PercentLines;
    target.percent[field] = (target.percent[field] ?? 0) + (v as number);
  }
  for (const [k, v] of Object.entries(src.soul)) {
    const field = k as keyof SoulStats;
    target.soul[field] = (target.soul[field] ?? 0) + (v as number);
  }
  return target;
}

function findRelic(state: EquipmentState, id: string | null): RelicInstance | undefined {
  return id === null ? undefined : state.relics.find((r) => r.id === id);
}


function findCore(state: EquipmentState, id: string | null): CoreInstance | undefined {
  return id === null ? undefined : state.cores.find((c) => c.id === id);
}

export interface LayerDelta {
  relic: StatDelta;
  plates: StatDelta;
  trinkets: StatDelta;
  resonance: StatDelta;
  titles: StatDelta;
  runes: StatDelta;
  charms: StatDelta;
  cores: StatDelta;
}

/** The element-keyed plate a Wild brings to a fold (stage 0 is empty). */
export interface PlateFold {
  faction: Faction;
  stage: number;
}

/** The species-signature trinket a Wild brings to a fold (level 0 is empty). */
export interface TrinketFold {
  speciesId: string;
  level: number;
}

/** A slotted Wild's share of the Link Crystal level, scaled per level. */
export interface ResonanceFold {
  level: number;
  perLevel: Partial<CoreStats>;
}

/** Account-wide title lines at their current stages (flat or percent totals). */
export interface TitleFold {
  lines: StatLine[];
}

export interface FoldedLoadout {
  /** Every layer combined. */
  delta: StatDelta;
  /** Per-layer, for the Wild screen's stat-delta display. */
  layers: LayerDelta;
  effects: RoundEffect[];
  /** M11.4 merged Soul-heart hooks (same-stat ladders keep the highest). */
  soulheart: SoulheartHooks;
  /** Authored set-bonus sentences for the gear screen. */
  soulheartText: string[];
  /** E2: held-item skill triggers and damage modifiers for the battle spec. */
  triggers: TriggerDef[];
  damageMods: DamageMod[];
}

const HOOK_NUMBERS = [
  'lifesteal',
  'shieldDmgBonus',
  'shieldedDmgBonus',
  'turnHeal',
  'paralysisChance',
  'startShield',
  'overhealShield',
  'startDmgRdct',
  'firstRoundSpiritDefMult',
  'firstRoundDmgRdct',
  'spiritAtkMult',
  'spiritDefMult',
  'sAtkMult',
] as const;

function mergeHook(out: SoulheartHooks, src: SoulheartHooks): void {
  for (const key of HOOK_NUMBERS) {
    const value = src[key];
    if (value === undefined) continue;
    out[key] = Math.max(out[key] ?? 0, value);
  }
  if (src.punctureEvery !== undefined) {
    out.punctureEvery = out.punctureEvery === undefined ? src.punctureEvery : Math.min(out.punctureEvery, src.punctureEvery);
  }
  if (src.controlImmunityEvery !== undefined) {
    out.controlImmunityEvery =
      out.controlImmunityEvery === undefined
        ? src.controlImmunityEvery
        : Math.min(out.controlImmunityEvery, src.controlImmunityEvery);
  }
  if (src.roundHeal && (!out.roundHeal || src.roundHeal.rate > out.roundHeal.rate)) out.roundHeal = src.roundHeal;
  if (src.onHitHeal && (!out.onHitHeal || src.onHitHeal.rate > out.onHitHeal.rate)) out.onHitHeal = src.onHitHeal;
}

function emptyLayers(): LayerDelta {
  return {
    relic: emptyDelta(),
    plates: emptyDelta(),
    trinkets: emptyDelta(),
    resonance: emptyDelta(),
    titles: emptyDelta(),
    runes: emptyDelta(),
    charms: emptyDelta(),
    cores: emptyDelta(),
  };
}

/** Fold a Wild's loadout into one delta, per-layer deltas and conditional effects. */
export function foldLoadout(
  loadout: Loadout,
  state: EquipmentState,
  tables: EquipmentTables,
  plate?: PlateFold,
  trinket?: TrinketFold,
  resonance?: ResonanceFold,
  title?: TitleFold,
): FoldedLoadout {
  const layers = emptyLayers();
  const effects: RoundEffect[] = [];
  const soulheart: SoulheartHooks = {};
  const soulheartText: string[] = [];

  // --- Held items (R5): main stat by level + rolled lines; faction lines need the wearer's
  // faction, which arrives with the plate fold. Absorb HP Rate becomes lifesteal. ---
  const relic = findRelic(state, loadout.relic);
  const relicDef = relic ? tables.relics.find((d) => d.id === relic.defId) : undefined;
  let heldLifesteal = 0;
  const triggers: TriggerDef[] = [];
  const damageMods: DamageMod[] = [];
  if (relic && relicDef) {
    const held = heldDelta(relic, relicDef, tables.held, plate?.faction);
    addDelta(layers.relic, held.delta);
    heldLifesteal = held.lifesteal;
    if (relicDef.skill?.active) {
      effects.push(...relicDef.skill.effects);
      triggers.push(...(relicDef.skill.triggers ?? []));
      damageMods.push(...(relicDef.skill.damageMods ?? []));
    }
  }

  // --- Plates: the faction's plate, scaled by its stage (0 adds nothing) ---
  if (plate && plate.stage > 0) {
    const plateDef = tables.plates.find((d) => d.faction === plate.faction);
    if (plateDef) addLines(layers.plates, plateDef.lines, plate.stage);
  }

  // --- Trinkets: one signature line set per species, scaled by level ---
  if (trinket && trinket.level > 0) {
    const trinketDef = tables.trinkets.find((d) => d.speciesId === trinket.speciesId);
    if (trinketDef) addLines(layers.trinkets, trinketDef.lines, trinket.level);
  }

  // --- Resonance: a slotted Wild's share of the Link Crystal level ---
  if (resonance && resonance.level > 0) {
    for (const [key, perLevel] of Object.entries(resonance.perLevel)) {
      if (typeof perLevel !== 'number') continue;
      const field = key as keyof CoreStats;
      layers.resonance.core[field] = (layers.resonance.core[field] ?? 0) + resonance.level * perLevel;
    }
  }

  // --- Titles: account-wide lines from the three equipped slots ---
  if (title) addLines(layers.titles, title.lines, 1);

  // --- Orbs (R3): socketed orbs' lines plus their sets ---
  const socketed = loadout.orbs.flatMap((id) => {
    const orb = id === null ? undefined : state.orbs.find((o) => o.id === id);
    return orb ? [orb] : [];
  });
  const orbFold = foldOrbs(tables.orbs, socketed);
  addDelta(layers.runes, orbFold.delta);
  damageMods.push(...orbFold.damageMods);

  // --- Charms: each owned, equipped Berry; starred tiers scale their lines ---
  const charmUses = new Map<string, number>();
  for (const id of loadout.charms) {
    if (id === null) continue;
    const used = (charmUses.get(id) ?? 0) + 1;
    if (used > (state.charms[id] ?? 0)) continue;
    charmUses.set(id, used);
    const def = tables.charms.find((c) => c.id === id);
    if (def) {
      const stars = def.maxStars > 0 ? Math.min(def.maxStars, Math.max(1, state.charmStars[def.id] ?? 1)) : 1;
      addLines(layers.charms, def.lines, stars);
    }
  }

  // --- Spirit cores: per-socket lines + 2/4/6-piece set bonuses ---
  const coreSetCounts = new Map<string, number>();
  for (const id of loadout.cores) {
    const core = findCore(state, id);
    const def = core ? tables.coreSets.find((s) => s.id === core.setId) : undefined;
    if (!core || !def) continue;
    const template = def.socketLines[core.socket] ?? [];
    // R6c: stars start at 0 (source); the line's first value is the 0★ piece.
    addLines(layers.cores, template, core.stars + 1);
    coreSetCounts.set(core.setId, (coreSetCounts.get(core.setId) ?? 0) + 1);
  }
  for (const set of tables.coreSets) {
    const count = coreSetCounts.get(set.id) ?? 0;
    const reached = set.bonuses.filter((bonus) => count >= bonus.pieces);
    // Same-stat ladders keep the highest reached line rather than summing 2/4/6.
    const bestLine = new Map<string, StatLine>();
    for (const bonus of reached) {
      for (const line of bonus.lines) {
        const prev = bestLine.get(line.field);
        if (!prev || Math.abs(line.base) > Math.abs(prev.base)) bestLine.set(line.field, line);
      }
    }
    for (const line of bestLine.values()) addLine(layers.cores, line, 1);
    for (const bonus of reached) {
      if (bonus.effect) effects.push(bonus.effect);
      if (bonus.soulheart) {
        mergeHook(soulheart, bonus.soulheart);
        soulheartText.push(bonus.soulheart.text);
      }
      if (bonus.text) soulheartText.push(bonus.text);
    }
  }

  if (heldLifesteal > 0) soulheart.lifesteal = (soulheart.lifesteal ?? 0) + heldLifesteal;

  const delta = emptyDelta();
  addDelta(delta, layers.relic);
  addDelta(delta, layers.plates);
  addDelta(delta, layers.trinkets);
  addDelta(delta, layers.resonance);
  addDelta(delta, layers.titles);
  addDelta(delta, layers.runes);
  addDelta(delta, layers.charms);
  addDelta(delta, layers.cores);
  return { delta, layers, effects, soulheart, soulheartText, triggers, damageMods };
}

/**
 * Merge a delta into a combat sheet: core + soul values are rounded to integers,
 * percent lines stay fractional (they are fractions — 0.15 == 15%).
 */
export function mergeDelta(sheet: SheetInput, delta: StatDelta): SheetInput {
  const out: SheetInput = { ...sheet };
  // SheetInput's numeric fields are all numbers, so a numeric record view is sound.
  const numeric = out as unknown as Record<string, number>;
  for (const [k, v] of Object.entries(delta.core)) numeric[k] = (numeric[k] ?? 0) + Math.round(v as number);
  for (const [k, v] of Object.entries(delta.percent)) numeric[k] = (numeric[k] ?? 0) + (v as number);
  for (const [k, v] of Object.entries(delta.soul)) numeric[k] = (numeric[k] ?? 0) + (v as number);
  return out;
}
