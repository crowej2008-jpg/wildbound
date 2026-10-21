import type { RoundEffect, SoulheartHooks } from '../combat/types';
import type { SheetInput } from '../combat/types';
import type { CoreStats, PercentLines, SoulStats } from '../model';
import {
  emptyDelta,
  type CoreInstance,
  type EquipmentState,
  type EquipmentTables,
  type Loadout,
  type RelicInstance,
  type RuneInstance,
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

/** Scale an effect by the relic's refine level (each refine adds 20%). */
export function refineEffect(effect: RoundEffect, refine: number, step = 0.2): RoundEffect {
  const scale = 1 + Math.max(0, refine) * step;
  return {
    ...effect,
    add: effect.add === undefined ? undefined : effect.add * scale,
    mult: effect.mult === undefined ? undefined : 1 + (effect.mult - 1) * scale,
  };
}

function findRelic(state: EquipmentState, id: string | null): RelicInstance | undefined {
  return id === null ? undefined : state.relics.find((r) => r.id === id);
}

function findRune(state: EquipmentState, id: string | null): RuneInstance | undefined {
  return id === null ? undefined : state.runes.find((r) => r.id === id);
}

function findCore(state: EquipmentState, id: string | null): CoreInstance | undefined {
  return id === null ? undefined : state.cores.find((c) => c.id === id);
}

export interface LayerDelta {
  relic: StatDelta;
  runes: StatDelta;
  charms: StatDelta;
  cores: StatDelta;
  talents: StatDelta;
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
  return { relic: emptyDelta(), runes: emptyDelta(), charms: emptyDelta(), cores: emptyDelta(), talents: emptyDelta() };
}

/** Fold a Wild's loadout into one delta, per-layer deltas and conditional effects. */
export function foldLoadout(
  loadout: Loadout,
  state: EquipmentState,
  tables: EquipmentTables,
): FoldedLoadout {
  const layers = emptyLayers();
  const effects: RoundEffect[] = [];
  const soulheart: SoulheartHooks = {};
  const soulheartText: string[] = [];

  // --- Relics: lines scale with level; the design's effect scales with refine ---
  const relic = findRelic(state, loadout.relic);
  const relicDef = relic ? tables.relics.find((d) => d.id === relic.defId) : undefined;
  if (relic && relicDef) {
    addLines(layers.relic, relicDef.lines, relic.level);
    effects.push(refineEffect(relicDef.effect, relic.refine));
  }

  // --- Runes: per-socket lines + a set bonus once enough pieces are worn ---
  const setCounts = new Map<string, number>();
  for (const id of loadout.runes) {
    const rune = findRune(state, id);
    const def = rune ? tables.runes.find((d) => d.id === rune.defId) : undefined;
    if (!rune || !def) continue;
    addLines(layers.runes, def.lines, rune.level);
    setCounts.set(def.setId, (setCounts.get(def.setId) ?? 0) + 1);
  }
  for (const set of tables.runeSets) {
    const count = setCounts.get(set.id) ?? 0;
    for (const bonus of set.bonuses) {
      if (count >= bonus.pieces) addLines(layers.runes, bonus.lines, 1);
    }
  }

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
    addLines(layers.cores, template, core.stars);
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

  // --- Talents: static battle lines from the chosen option on each tier ---
  const tree = loadout.treeId ? tables.talentTrees.find((t) => t.id === loadout.treeId) : undefined;
  if (tree) {
    tree.tiers.forEach((options, tier) => {
      const choice = loadout.talents[tier] ?? -1;
      if (choice < 0) return;
      const blockId = options[choice];
      const block = blockId ? tables.talentBlocks.find((b) => b.id === blockId) : undefined;
      if (!block) return;
      addLines(layers.talents, block.lines, 1);
      if (block.effect) effects.push(block.effect);
    });
  }

  const delta = emptyDelta();
  addDelta(delta, layers.relic);
  addDelta(delta, layers.runes);
  addDelta(delta, layers.charms);
  addDelta(delta, layers.cores);
  addDelta(delta, layers.talents);
  return { delta, layers, effects, soulheart, soulheartText };
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
