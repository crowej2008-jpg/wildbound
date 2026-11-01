import type { Rng } from '../rng';
import type { StatDelta, StatKind } from './types';

/**
 * R6d: the source's berries (scripts/import-berries.mjs). A berry is an instance: its star (Elevation, 1–5;
 * Commons have none), its breakthrough stage (+0…+4, gated by trainer level) and its cultivated lines — one at
 * the start and one more per breakthrough (up to 5), each a line kind from the pool of 15 grown by Cultivation
 * towards its cap at the current stage, and re-rollable by Reforge. A Pokémon carries two, never two of a type.
 */

export type BerryTier = 'common' | 'basic' | 'intermediate' | 'greater';

export interface BerryDef {
  id: string;
  sourceId: number;
  name: string;
  tier: BerryTier;
  /** Two berries of one type cannot sit on the same Pokémon. */
  typeId: number;
  /** 0 for the Commons (fixed, uncultivatable), else 1. */
  initStar: number;
  maxStar: number;
  dismantleEssence: number;
  skills: { star: number; name: string; text: string }[];
}

export interface BerryElement {
  id: number;
  kind: StatKind;
  field: string;
  /** The cap at breakthrough stage 0–4. */
  caps: number[];
}

export interface BerryTables {
  linesAtStart: number;
  maxLines: number;
  cultivateEssence: number;
  fastCultivateTimes: number;
  /** Reforge Potions to re-roll line 1–5. */
  reforgePotions: number[];
  rebirthGems: number;
  /** One ladder for every star-able berry: stats at the star and the price of the next. */
  stars: { star: number; hp: number; pAtk: number; sAtk: number; next: { sameCopies: number; anyCopies: number; gold: number } | null }[];
  breakthrough: { stage: number; trainerLevel: number; cost: { currency: string; amount: number }; hp: number; pAtk: number; sAtk: number }[];
  elements: BerryElement[];
  berries: BerryDef[];
}

export interface BerryLine {
  element: number;
  value: number;
}

export interface BerryInstance {
  id: string;
  defId: string;
  star: number;
  stage: number;
  lines: BerryLine[];
  /** Never cultivated: only these can be dismantled or fed to an Elevation. */
  cultivated: boolean;
  locked: boolean;
}

export function berryDef(tables: BerryTables, defId: string): BerryDef | undefined {
  return tables.berries.find((b) => b.id === defId);
}

export function berryElement(tables: BerryTables, id: number): BerryElement | undefined {
  return tables.elements.find((e) => e.id === id);
}

export function berryCultivatable(def: BerryDef): boolean {
  return def.maxStar > 0;
}

export function lineCap(tables: BerryTables, element: number, stage: number): number {
  const e = berryElement(tables, element);
  return e ? e.caps[Math.max(0, Math.min(e.caps.length - 1, stage))] ?? 0 : 0;
}

/** Share of the caps the berry's lines have reached (the source's "cultivation progress"). */
export function cultivationProgress(tables: BerryTables, b: BerryInstance): number {
  if (b.lines.length === 0) return 0;
  const shares = b.lines.map((l) => {
    const cap = lineCap(tables, l.element, b.stage);
    return cap > 0 ? Math.min(1, l.value / cap) : 0;
  });
  return shares.reduce((a, s) => a + s, 0) / shares.length;
}

/** A line kind not already on the berry, drawn uniformly. */
function freshElement(tables: BerryTables, b: { lines: BerryLine[] }, rng: Rng, except?: number): number {
  const taken = new Set(b.lines.map((l) => l.element));
  const pool = tables.elements.map((e) => e.id).filter((id) => !taken.has(id) && id !== except);
  return pool[Math.floor(rng() * pool.length)] ?? tables.elements[0]!.id;
}

/** A new berry (a drop / a grant): its start star, stage 0 and its first line(s). */
export function rollBerry(tables: BerryTables, def: BerryDef, id: string, rng: Rng): BerryInstance {
  const b: BerryInstance = { id, defId: def.id, star: def.initStar, stage: 0, lines: [], cultivated: false, locked: false };
  if (berryCultivatable(def)) {
    for (let n = 0; n < tables.linesAtStart; n += 1) b.lines.push({ element: freshElement(tables, b, rng), value: 0 });
  }
  return b;
}

/**
 * Stand-in (ASSUMPTIONS #70): one Cultivation raises every line by a random 1–3 % of its cap at the current
 * stage (the source's server decides; ~50 to fill a line).
 */
export const CULTIVATE_MIN_SHARE = 0.01;
export const CULTIVATE_MAX_SHARE = 0.03;

export function cultivateBerry(tables: BerryTables, b: BerryInstance, times: number, rng: Rng): BerryInstance {
  const lines = b.lines.map((l) => ({ ...l }));
  for (let n = 0; n < times; n += 1) {
    for (const l of lines) {
      const cap = lineCap(tables, l.element, b.stage);
      const step = cap * (CULTIVATE_MIN_SHARE + rng() * (CULTIVATE_MAX_SHARE - CULTIVATE_MIN_SHARE));
      l.value = Math.min(cap, roundLine(l.value + step, cap));
    }
  }
  return { ...b, lines, cultivated: true };
}

/** Flat lines whole numbers; percent lines to 1/10,000 (the source stores hundredths of a percent). */
function roundLine(v: number, cap: number): number {
  return cap >= 1 ? Math.round(v) : Math.round(v * 10000) / 10000;
}

export function cultivationFull(tables: BerryTables, b: BerryInstance): boolean {
  return b.lines.every((l) => l.value >= lineCap(tables, l.element, b.stage));
}

/** Breakthrough to the next stage: the caps rise, and a new line opens (up to `maxLines`). */
export function breakthroughBerry(tables: BerryTables, b: BerryInstance, rng: Rng): BerryInstance {
  const lines = b.lines.map((l) => ({ ...l }));
  if (lines.length < tables.maxLines) lines.push({ element: freshElement(tables, { lines }, rng), value: 0 });
  return { ...b, stage: b.stage + 1, lines };
}

/** Stand-in (ASSUMPTIONS #70): Reforge re-rolls one line's kind; it keeps its share of the cap. */
export function reforgeBerryLine(tables: BerryTables, b: BerryInstance, index: number, rng: Rng): BerryInstance {
  const old = b.lines[index];
  if (!old) return b;
  const element = freshElement(tables, b, rng, old.element);
  const oldCap = lineCap(tables, old.element, b.stage);
  const share = oldCap > 0 ? old.value / oldCap : 0;
  const cap = lineCap(tables, element, b.stage);
  const lines = b.lines.map((l, i) => (i === index ? { element, value: roundLine(cap * share, cap) } : { ...l }));
  return { ...b, lines };
}

/** The berry's stats: its star row, its breakthrough row and its cultivated lines. */
export function berryDelta(tables: BerryTables, b: BerryInstance): StatDelta {
  const delta: StatDelta = { core: {}, percent: {}, soul: {} };
  const add = (kind: StatKind, field: string, v: number) => {
    if (!v) return;
    const bag = (kind === 'core' ? delta.core : kind === 'percent' ? delta.percent : delta.soul) as Record<string, number>;
    bag[field] = (bag[field] ?? 0) + v;
  };
  const def = berryDef(tables, b.defId);
  if (def && berryCultivatable(def)) {
    const row = tables.stars.find((s) => s.star === b.star);
    if (row) {
      add('core', 'hp', row.hp);
      add('core', 'pAtk', row.pAtk);
      add('core', 'sAtk', row.sAtk);
    }
    const br = tables.breakthrough.find((s) => s.stage === b.stage);
    if (br) {
      add('core', 'hp', br.hp);
      add('core', 'pAtk', br.pAtk);
      add('core', 'sAtk', br.sAtk);
    }
  }
  for (const l of b.lines) {
    const e = berryElement(tables, l.element);
    if (e) add(e.kind, e.field, l.value);
  }
  return delta;
}
