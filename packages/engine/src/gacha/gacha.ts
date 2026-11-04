import type { Faction } from '../model';
import type { Rng } from '../rng';
import type {
  DrawResult,
  GachaGroup,
  GachaMachineDef,
  GachaMachineState,
  GachaRow,
  SupremeGiftDef,
  WishingWellDef,
} from './types';

/**
 * Summoning rules — R9, copied from the source (docs/design/gacha.md). Pure and content-free:
 * every function takes the pool rows, the machine's tuning and an injected `Rng`.
 *
 * A draw picks one pool row by weight — the odds the source shows (ASSUMPTIONS #83: the server's
 * own odds are not in the dumps). There is no pity and no ten-draw guarantee in the source; the
 * Wishing Well and the Supreme Gift are the only helps.
 */

/** A weighted pick over a list of positive weights (falls back to the last entry). */
export function weightedIndex(rng: Rng, weights: readonly number[]): number {
  const total = weights.reduce((sum, w) => sum + Math.max(0, w), 0);
  if (total <= 0) return weights.length - 1;
  let roll = rng() * total;
  for (let i = 0; i < weights.length; i++) {
    roll -= Math.max(0, weights[i] ?? 0);
    if (roll < 0) return i;
  }
  return weights.length - 1;
}

/** The Wishing Well in force on a draw: the chosen faction, the boosted tier and the factor. */
export interface ActiveWish {
  faction: Faction;
  tier: GachaRow['tier'];
  boost: number;
}

/** A row's weight after the Wishing Well. */
export function rowWeight(row: GachaRow, wish: ActiveWish | null): number {
  const boosted = wish !== null && row.faction === wish.faction && row.tier === wish.tier;
  return Math.max(0, row.weight) * (boosted ? wish.boost : 1);
}

/** One draw: a pool row by weight. `isNew` is left false — the caller fills it against the roster. */
export function drawRow(rng: Rng, rows: readonly GachaRow[], wish: ActiveWish | null): DrawResult {
  const row = rows[weightedIndex(rng, rows.map((r) => rowWeight(r, wish)))];
  if (!row) throw new Error('empty summon pool');
  return { speciesId: row.speciesId, star: row.star, tier: row.tier, group: row.group, isNew: false };
}

export function drawBatch(rng: Rng, rows: readonly GachaRow[], wish: ActiveWish | null, count: number): DrawResult[] {
  return Array.from({ length: count }, () => drawRow(rng, rows, wish));
}

/** A box can be claimed while its credits cover the machine's requirement. */
export function boxReady(state: GachaMachineState, machine: GachaMachineDef): boolean {
  return machine.boxCreditsNeeded > 0 && state.boxCredits >= machine.boxCreditsNeeded;
}

export function boxProgress(state: GachaMachineState, machine: GachaMachineDef): number {
  if (machine.boxCreditsNeeded <= 0) return 0;
  return Math.min(1, state.boxCredits / machine.boxCreditsNeeded);
}

/** The Wishing Well opens once the machine's lifetime draws reach `unlockDraws`. */
export function wellUnlocked(well: WishingWellDef, state: GachaMachineState): boolean {
  return state.lifetimeDraws >= well.unlockDraws;
}

/** The wish that applies to a machine's draws, or null. */
export function activeWish(
  well: WishingWellDef,
  machine: GachaMachineDef,
  state: GachaMachineState,
  faction: Faction | null,
): ActiveWish | null {
  if (faction === null || machine.id !== well.machine || !wellUnlocked(well, state)) return null;
  if (!well.factions.includes(faction)) return null;
  return { faction, tier: well.tier, boost: well.boost };
}

/** The Supreme Gift opens while VIP credits cover it and the VIP level is high enough. */
export function giftReady(gift: SupremeGiftDef, vipCredits: number, vipLevel: number): boolean {
  return vipLevel >= gift.vipLevel && vipCredits >= gift.credits;
}

/** One Supreme Gift: a Pokémon from its list at equal weight. */
export function openGift(rng: Rng, gift: SupremeGiftDef): string {
  const index = Math.min(gift.species.length - 1, Math.floor(rng() * gift.species.length));
  const pick = gift.species[index];
  if (pick === undefined) throw new Error('empty Supreme Gift');
  return pick;
}

/** A row's chance of one draw, for the rates sheet. */
export interface RowProbability {
  speciesId: string;
  star: number;
  group: GachaGroup;
  probability: number;
}

export function probabilityTable(rows: readonly GachaRow[], wish: ActiveWish | null): RowProbability[] {
  const total = rows.reduce((sum, r) => sum + rowWeight(r, wish), 0);
  if (total <= 0) return [];
  return rows.map((r) => ({ speciesId: r.speciesId, star: r.star, group: r.group, probability: rowWeight(r, wish) / total }));
}

/** The groups in the order the source lists them (rarest first) with their summed chance. */
export const GROUP_ORDER: readonly GachaGroup[] = ['mythic', 'supreme', 'legendary', 'epic', 'other'];

export function groupTable(table: readonly RowProbability[]): { group: GachaGroup; probability: number }[] {
  return GROUP_ORDER.map((group) => ({
    group,
    probability: table.filter((r) => r.group === group).reduce((sum, r) => sum + r.probability, 0),
  })).filter((g) => g.probability > 0);
}
