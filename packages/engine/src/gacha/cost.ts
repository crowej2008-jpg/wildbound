import type { GachaMachineDef } from './types';

/**
 * Summon pricing (M6, PROMPT §7.5): a single draw spends a free draw while one is
 * left, then a ticket, then gems (Premium only). A ten-draw spends 10 tickets,
 * then gems. Pure — the caller supplies the current wallets.
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

/**
 * Resolve how a draw of `count` (1 or 10) is paid for. Fails when nothing covers
 * the price. Free draws are consumed first on a single draw only.
 */
export function resolveSummonCost(
  machine: GachaMachineDef,
  count: number,
  currencies: Record<string, number>,
  freeRemaining: number,
): CostResolution {
  if (count !== 1 && count !== 10) return { ok: false, reason: 'invalid_input' };
  const tickets = Math.max(0, currencies[machine.ticket] ?? currencies.tickets ?? 0);
  const gems = Math.max(0, currencies.gems ?? 0);

  if (count === 1 && freeRemaining > 0) {
    return { ok: true, cost: { free: 1, tickets: 0, gems: 0 } };
  }
  if (count === 1 && tickets > 0) {
    return { ok: true, cost: { free: 0, tickets: 1, gems: 0 } };
  }
  if (count > 1 && tickets >= count) {
    return { ok: true, cost: { free: 0, tickets: count, gems: 0 } };
  }
  const gemPrice = count === 1 ? machine.gemPerDraw : machine.gemPerTen;
  if (gemPrice !== null && gems >= gemPrice) {
    return { ok: true, cost: { free: 0, tickets: 0, gems: gemPrice } };
  }
  return { ok: false, reason: 'insufficient_items' };
}
