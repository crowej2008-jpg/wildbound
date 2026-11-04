import {
  boxOdds,
  chooseRow,
  composable,
  MAX_BAG_BATCH,
  rollBoxes,
  type AccountState,
  type BoxDef,
  type BoxKind,
  type CurrencyId,
  type DrawResult,
  type Rng,
} from '@wildbound/engine';
import { firstStar, type GameConfig } from './config';
import { grantDraws } from './gacha';
import type { Outcome } from './outcome';

/**
 * R9: the Bag's generic Pokémon shards and Pokémon boxes, copied from the source
 * (docs/design/bag.md, ASSUMPTIONS #84). Composing a random Pokémon box opens it at once; the
 * Selectable Precious Giftbox and the reward boxes stay in the bag until opened.
 */

/** What a compose or open produced: Pokémon (with "new" marks) and/or species shards. */
export interface BagResult {
  state: AccountState;
  draws: DrawResult[];
  /** Species shards granted (the Giftbox), by species. */
  shards: Record<string, number>;
  /** Boxes made that stay in the bag (e.g. the Giftbox), by box id. */
  boxes: Record<string, number>;
}

function boxById(config: GameConfig, id: string): BoxDef | undefined {
  return config.bag.boxes.find((b) => b.id === id);
}

function currency(state: AccountState, id: string): number {
  return state.currencies[id as CurrencyId] ?? 0;
}

function withCurrency(state: AccountState, id: string, value: number): AccountState {
  return { ...state, currencies: { ...state.currencies, [id]: value } };
}

function validTimes(times: number): boolean {
  return Number.isInteger(times) && times >= 1 && times <= MAX_BAG_BATCH;
}

/** Turn rolled rows into Pokémon at their card star (or the species' first star). */
function grantRows(config: GameConfig, state: AccountState, rows: readonly { species: string; star: number | null }[], now: number) {
  const draws = rows.map((row) => {
    const meta = config.species.get(row.species);
    if (!meta) throw new Error(`unknown species "${row.species}"`);
    return { speciesId: row.species, star: row.star ?? firstStar(meta), tier: meta.tier, group: 'other' as const };
  });
  return grantDraws(state, draws, now);
}

/** Spend shards on `times` boxes of a recipe; a random Pokémon box opens itself, others go to the bag. */
export function applyCompose(
  config: GameConfig,
  state: AccountState,
  from: string,
  times: number,
  now: number,
  rng: Rng,
): Outcome<BagResult> {
  const recipe = config.bag.recipes.find((r) => r.from === from);
  if (!recipe) return { ok: false, error: 'not_found', message: `nothing composes from "${from}"` };
  if (!validTimes(times)) return { ok: false, error: 'invalid_input', message: `make 1 to ${MAX_BAG_BATCH} at a time` };
  const box = boxById(config, recipe.box);
  if (!box) return { ok: false, error: 'not_found', message: `unknown box "${recipe.box}"` };
  const have = currency(state, from);
  if (composable(recipe, have) < times) {
    return { ok: false, error: 'insufficient_items', message: `needs ${recipe.count * times} shards` };
  }
  const spent = withCurrency(state, from, have - recipe.count * times);
  if (box.autoOpen && box.kind === 'random') {
    const granted = grantRows(config, spent, rollBoxes(rng, box, times), now);
    return { ok: true, value: { state: granted.state, draws: granted.draws, shards: {}, boxes: {} } };
  }
  const next = withCurrency(spent, box.id, currency(spent, box.id) + times);
  return { ok: true, value: { state: next, draws: [], shards: {}, boxes: { [box.id]: times } } };
}

/** Open `times` random boxes held in the bag. */
export function applyOpenBox(
  config: GameConfig,
  state: AccountState,
  boxId: string,
  times: number,
  now: number,
  rng: Rng,
): Outcome<BagResult> {
  const box = boxById(config, boxId);
  if (!box || box.autoOpen) return { ok: false, error: 'not_found', message: `no box "${boxId}" in the bag` };
  if (box.kind !== 'random') return { ok: false, error: 'invalid_input', message: 'choose what this box gives' };
  if (!validTimes(times)) return { ok: false, error: 'invalid_input', message: `open 1 to ${MAX_BAG_BATCH} at a time` };
  const have = currency(state, boxId);
  if (have < times) return { ok: false, error: 'insufficient_items', message: 'not enough boxes' };
  const granted = grantRows(config, withCurrency(state, boxId, have - times), rollBoxes(rng, box, times), now);
  return { ok: true, value: { state: granted.state, draws: granted.draws, shards: {}, boxes: {} } };
}

/** Open one choice box for the chosen species: that Pokémon, or (Giftbox) its shards. */
export function applyChooseBox(
  config: GameConfig,
  state: AccountState,
  boxId: string,
  species: string,
  now: number,
): Outcome<BagResult> {
  const box = boxById(config, boxId);
  if (!box || box.autoOpen) return { ok: false, error: 'not_found', message: `no box "${boxId}" in the bag` };
  const row = chooseRow(box, species);
  if (!row) return { ok: false, error: 'invalid_input', message: `this box does not offer "${species}"` };
  const have = currency(state, boxId);
  if (have < 1) return { ok: false, error: 'insufficient_items', message: 'no box to open' };
  const spent = withCurrency(state, boxId, have - 1);
  if (box.kind === 'chooseShards') {
    const shards = { ...spent.speciesShards, [species]: (spent.speciesShards[species] ?? 0) + row.weight };
    return { ok: true, value: { state: { ...spent, speciesShards: shards }, draws: [], shards: { [species]: row.weight }, boxes: {} } };
  }
  const granted = grantRows(config, spent, [row], now);
  return { ok: true, value: { state: granted.state, draws: granted.draws, shards: {}, boxes: {} } };
}

export interface BagRecipeView {
  from: string;
  count: number;
  have: number;
  /** Boxes the shards can make now (≤ 999). */
  makes: number;
  box: string;
}

export interface BagBoxView {
  id: string;
  kind: BoxKind;
  autoOpen: boolean;
  /** Boxes held (0 for boxes that open themselves). */
  have: number;
  /** Every row: random boxes with their chance; choice boxes with the shards (Giftbox) or 1. */
  rows: { species: string; star: number; amount: number; probability: number | null }[];
}

export interface BagView {
  recipes: BagRecipeView[];
  boxes: BagBoxView[];
}

/** Display-ready Bag: what the shards can make and every box's contents. */
export function bagView(config: GameConfig, state: AccountState): BagView {
  const recipes = config.bag.recipes.map((r) => {
    const have = currency(state, r.from);
    return { from: r.from, count: r.count, have, makes: composable(r, have), box: r.box };
  });
  const boxes = config.bag.boxes.map((box): BagBoxView => {
    const odds = box.kind === 'random' ? boxOdds(box) : null;
    return {
      id: box.id,
      kind: box.kind,
      autoOpen: box.autoOpen,
      have: box.autoOpen ? 0 : currency(state, box.id),
      rows: box.rows.map((row, i) => {
        const meta = config.species.get(row.species);
        return {
          species: row.species,
          star: row.star ?? (meta ? firstStar(meta) : 1),
          amount: box.kind === 'chooseShards' ? row.weight : 1,
          probability: odds ? (odds[i]?.probability ?? 0) : null,
        };
      }),
    };
  });
  return { recipes, boxes };
}
