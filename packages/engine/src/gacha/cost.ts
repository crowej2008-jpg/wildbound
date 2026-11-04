import type { GachaMachineDef } from './types';

/**
 * Summon pricing — the source client's own price pick (kb/gacha.md, ChestInfo.getItemCost /
 * getCostForTen): a single draw takes a free draw while one is left, then a ticket, then gems; a
 * ten-draw takes 10 tickets, then gems. The Premium "plus" multi-draw (20 … 50) is tickets only.
 * Pure — the caller supplies the current wallets.
 */

export interface SummonCost {
  free: number;
  tickets: number;
  gems: number;
}

export type CostResolution =
  | { ok: true; cost: SummonCost }
  | { ok: false; reason: 'insufficient_items' | 'invalid_input' };

export function emptySummonCost(): SummonCost {
  return { free: 0, tickets: 0, gems: 0 };
}

/** Draw counts a machine accepts: 1, 10 and (tickets only) 20 … 10 × maxTenBatches. */
export function summonCounts(machine: GachaMachineDef): number[] {
  const counts = [1];
  for (let batches = 1; batches <= Math.max(1, machine.maxTenBatches); batches++) counts.push(batches * 10);
  return counts;
}

/**
 * Resolve how a draw of `count` is paid for. Fails when nothing covers the price. Free draws are
 * used on a single draw only.
 */
export function resolveSummonCost(
  machine: GachaMachineDef,
  count: number,
  currencies: Record<string, number>,
  freeRemaining: number,
): CostResolution {
  if (!summonCounts(machine).includes(count)) return { ok: false, reason: 'invalid_input' };
  const tickets = Math.max(0, currencies[machine.ticket] ?? 0);
  const gems = Math.max(0, currencies.gems ?? 0);

  if (count === 1 && freeRemaining > 0) return { ok: true, cost: { free: 1, tickets: 0, gems: 0 } };
  if (tickets >= count) return { ok: true, cost: { free: 0, tickets: count, gems: 0 } };
  if (count > 10) return { ok: false, reason: 'insufficient_items' };
  const gemPrice = count === 1 ? machine.gemPerDraw : machine.gemPerTen;
  if (gemPrice !== null && gems >= gemPrice) return { ok: true, cost: { free: 0, tickets: 0, gems: gemPrice } };
  return { ok: false, reason: 'insufficient_items' };
}
