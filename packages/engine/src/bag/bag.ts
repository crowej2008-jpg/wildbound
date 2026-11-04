import type { Rng } from '../rng';
import { weightedIndex } from '../gacha/gacha';

/**
 * R9: the Bag's generic Pokémon shards and Pokémon boxes, copied from the source
 * (docs/design/bag.md, ASSUMPTIONS #84). Pure: the caller supplies the tables and an injected Rng.
 */

export type BoxKind = 'random' | 'chooseSpecies' | 'chooseShards';

/** One box row: a species, its exact star (null = first star) and a weight (or, chooseShards, the shards). */
export interface BoxRow {
  species: string;
  star: number | null;
  weight: number;
}

export interface BoxDef {
  id: string;
  kind: BoxKind;
  /** A composed random box opens itself at once and is never kept in the bag. */
  autoOpen: boolean;
  rows: readonly BoxRow[];
}

/** A compose recipe: `count` of the `from` currency make one `box`. */
export interface BagRecipe {
  from: string;
  count: number;
  box: string;
}

/** The source's compose panel makes at most this many boxes a press. */
export const MAX_BAG_BATCH = 999;

/** How many boxes `have` shards can make (capped at the source's 999). */
export function composable(recipe: BagRecipe, have: number): number {
  if (recipe.count <= 0) return 0;
  return Math.min(MAX_BAG_BATCH, Math.floor(Math.max(0, have) / recipe.count));
}

/** Open one random box: a row picked by weight. */
export function rollBox(rng: Rng, box: BoxDef): BoxRow {
  if (box.kind !== 'random') throw new Error(`box ${box.id} is a choice box`);
  const row = box.rows[weightedIndex(rng, box.rows.map((r) => r.weight))];
  if (!row) throw new Error(`box ${box.id} is empty`);
  return row;
}

/** Open `times` random boxes. */
export function rollBoxes(rng: Rng, box: BoxDef, times: number): BoxRow[] {
  return Array.from({ length: times }, () => rollBox(rng, box));
}

/** A choice box's row for a species, or undefined when the box does not offer it. */
export function chooseRow(box: BoxDef, species: string): BoxRow | undefined {
  if (box.kind === 'random') return undefined;
  return box.rows.find((r) => r.species === species);
}

/** The chance of each row of a random box (for the box's preview). */
export function boxOdds(box: BoxDef): { species: string; star: number | null; probability: number }[] {
  const total = box.rows.reduce((sum, r) => sum + Math.max(0, r.weight), 0);
  return box.rows.map((r) => ({ species: r.species, star: r.star, probability: total > 0 ? Math.max(0, r.weight) / total : 0 }));
}
