import type { Faction } from '../model';
import { randInt, type Rng } from '../rng';
import {
  emptyDelta,
  type HeldLine,
  type HeldLineRow,
  type HeldMainRow,
  type HeldTables,
  type RelicDef,
  type RelicInstance,
  type StatDelta,
} from './types';

/**
 * R5 held items, copied from the source (kb/held-items.md, held_item_* tables). Pure rules:
 * rolling a new item, its main stat at a level, its lines, the level and refine prices, and the
 * refine roll / keep-or-drop. Values in the tables are the source's own numbers: flat stats are
 * raw, percent stats are per ten-thousand (1,067 = 10.67%). See wiki/systems/held-items.md.
 */

export const HELD_SCALE = 10_000;

/** Draw one row from `rows` with weights (all equal in the source). */
function pickWeighted<T extends { weight: number }>(rows: T[], rng: Rng): T {
  const total = rows.reduce((sum, r) => sum + r.weight, 0);
  let roll = rng() * total;
  for (const row of rows) {
    roll -= row.weight;
    if (roll < 0) return row;
  }
  return rows[rows.length - 1]!;
}

/** The main-stat rows an item draws from: one group (HP, P.ATK or S.ATK) of its pool. */
export function mainRows(def: RelicDef, tables: HeldTables, group: number): HeldMainRow[] {
  return tables.mainPool.filter((r) => r.pool === def.mainPool && r.group === group);
}

export function linePoolOf(def: RelicDef, tables: HeldTables): HeldLineRow[] {
  return tables.linePool.filter((r) => r.pool === def.linePool);
}

/** A fresh line: any of the pool's lines at equal odds, an integer value inside its range. */
export function rollLine(def: RelicDef, tables: HeldTables, rng: Rng): { index: number; value: number } {
  const row = pickWeighted(linePoolOf(def, tables), rng);
  return { index: row.index, value: row.min + randInt(rng, row.max - row.min + 1) };
}

/**
 * A new item at level 0. The main stat's kind is random and independent of the item's class
 * (each group a third of the time); every line arrives with the item.
 */
export function rollHeldItem(def: RelicDef, tables: HeldTables, rng: Rng, id: string): RelicInstance {
  const groups = [...new Set(tables.mainPool.filter((r) => r.pool === def.mainPool).map((r) => r.group))].sort();
  const group = groups[randInt(rng, groups.length)] ?? 1;
  const lines: HeldLine[] = [];
  for (let i = 0; i < def.lineCount; i += 1) lines.push({ ...rollLine(def, tables, rng), refines: 0 });
  return { id, defId: def.id, level: 0, group, lines, refines: 0, pending: null, locked: false };
}

/** The main stat's value at a level: base + ⌊level / every⌋ × step. */
export function mainValue(row: HeldMainRow, level: number): number {
  return row.value + Math.floor(Math.max(0, level) / row.every) * row.step;
}

export function lineRow(tables: HeldTables, index: number): HeldLineRow | undefined {
  return tables.linePool.find((r) => r.index === index);
}

/**
 * Fold one item into a stat delta. Faction lines count only on a Pokémon of that faction
 * (measured in the source, 2026-10-04); Absorb HP Rate becomes lifesteal.
 */
export function heldDelta(
  inst: RelicInstance,
  def: RelicDef,
  tables: HeldTables,
  wearerFaction: Faction | undefined,
): { delta: StatDelta; lifesteal: number } {
  const delta = emptyDelta();
  let lifesteal = 0;
  for (const row of mainRows(def, tables, inst.group)) {
    const v = mainValue(row, inst.level);
    if (row.kind === 'core') {
      const field = row.field as keyof StatDelta['core'];
      delta.core[field] = (delta.core[field] ?? 0) + v;
    } else {
      const field = row.field as keyof StatDelta['percent'];
      delta.percent[field] = (delta.percent[field] ?? 0) + v / HELD_SCALE;
    }
  }
  for (const line of inst.lines) {
    const row = lineRow(tables, line.index);
    if (!row) continue;
    if (row.faction && row.faction !== wearerFaction) continue;
    const v = line.value / HELD_SCALE;
    if (row.kind === 'lifesteal') {
      lifesteal += v;
      continue;
    }
    const field = row.field as keyof StatDelta['percent'];
    delta.percent[field] = (delta.percent[field] ?? 0) + v;
  }
  return { delta, lifesteal };
}

// --- levels -----------------------------------------------------------------------

export function heldMaxLevel(tables: HeldTables): number {
  return tables.levelCost.length;
}

/** Held Item Shards to go from `level` to `level + 1`, or null at the cap. */
export function heldLevelCost(level: number, tables: HeldTables): number | null {
  return tables.levelCost[level] ?? null;
}

/** The resonance (Link Crystal) level the next level needs, if any. */
export function heldLevelGate(level: number, tables: HeldTables): number {
  let need = 0;
  for (const gate of tables.levelGates) if (level + 1 >= gate.level) need = Math.max(need, gate.resonance);
  return need;
}

/** Held Item Shards spent raising an item from 0 to `level`. */
export function heldShardsSpent(level: number, tables: HeldTables): number {
  return tables.levelCost.slice(0, Math.max(0, level)).reduce((a, b) => a + b, 0);
}

/** Dismantling pays the item's own shards plus every shard spent on its levels. */
export function heldDismantleShards(inst: RelicInstance, def: RelicDef, tables: HeldTables): number {
  return def.dismantle + heldShardsSpent(inst.level, tables);
}

// --- refining ---------------------------------------------------------------------

export function heldMaxRefine(tables: HeldTables): number {
  return tables.refineLadder.length;
}

/** Held Item Resetters for the item's next refine (owner's ladder), or null when spent. */
export function heldRefineCost(inst: RelicInstance, tables: HeldTables): number | null {
  return tables.refineLadder[inst.refines] ?? null;
}

export type RefineBlock = 'no_slots' | 'main_stat' | 'slot_limit' | 'max_refine' | null;

/**
 * Whether a line slot can be refined. Only `refineSlots` slots can ever be refined: a slot already
 * refined stays refinable; once that many slots have been refined, the rest are locked for good.
 */
export function refineBlock(inst: RelicInstance, def: RelicDef, tables: HeldTables, slot: number): RefineBlock {
  if (def.refineSlots <= 0) return 'no_slots';
  if (slot < 0 || slot >= inst.lines.length) return 'main_stat';
  if (inst.refines >= heldMaxRefine(tables)) return 'max_refine';
  if (inst.lines[slot]!.refines > 0) return null;
  const used = inst.lines.filter((l) => l.refines > 0).length;
  return used >= def.refineSlots ? 'slot_limit' : null;
}

/** Roll a new line into `slot`; it waits as `pending` until kept or dropped. */
export function rollRefine(inst: RelicInstance, def: RelicDef, tables: HeldTables, slot: number, rng: Rng): RelicInstance {
  const line = rollLine(def, tables, rng);
  const lines = inst.lines.map((l, i) => (i === slot ? { ...l, refines: l.refines + 1 } : l));
  return { ...inst, lines, refines: inst.refines + 1, pending: { slot, ...line } };
}

/** Keep (replace the slot's line) or drop (leave it) the pending roll. */
export function settleRefine(inst: RelicInstance, keep: boolean): RelicInstance {
  const pending = inst.pending;
  if (!pending) return inst;
  const lines = keep
    ? inst.lines.map((l, i) => (i === pending.slot ? { ...l, index: pending.index, value: pending.value } : l))
    : inst.lines;
  return { ...inst, lines, pending: null };
}
